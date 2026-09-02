<?php

namespace Tests\Feature;

use App\Models\SiteSlide;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Admin-managed public imagery:
 *   GET  /api/site-slides?type=carousel|popup   (public — the slideshow / popup)
 *   CRUD /api/admin/site-slides                  (admin only — upload / edit / order / hide)
 *
 * Verifies: the public feed only exposes ACTIVE slides of the asked-for type
 * in order; uploads accept only real images; non-admins are locked out;
 * replacing or deleting a slide also cleans up its stored file.
 */
class SiteSlideTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    /** A genuine PNG as an uploadable file (generated in-process, no temp file to lose). */
    private function pngUpload(string $name = 'slide.png'): UploadedFile
    {
        $img = imagecreatetruecolor(60, 40);
        ob_start();
        imagepng($img);
        $bytes = (string) ob_get_clean();
        imagedestroy($img);

        return UploadedFile::fake()->createWithContent($name, $bytes);
    }

    // ── Public feed ────────────────────────────────────────────────────

    public function test_public_slideshow_returns_only_active_carousel_slides_in_order(): void
    {
        $this->siteSlides()->create(['type' => 'carousel', 'title' => 'Second', 'sort_order' => 2]);
        $this->siteSlides()->create(['type' => 'carousel', 'title' => 'First',  'sort_order' => 1]);
        $this->siteSlides()->hidden()->create(['type' => 'carousel', 'title' => 'Hidden', 'sort_order' => 3]);
        $this->siteSlides()->popup()->create(['title' => 'A popup']);

        $res = $this->getJson('/api/site-slides?type=carousel')->assertOk();

        $titles = array_column($res->json(), 'title');
        $this->assertSame(['First', 'Second'], $titles); // ordered, no hidden, no popup
    }

    public function test_public_feed_can_ask_for_the_popup(): void
    {
        $this->siteSlides()->popup()->create(['title' => 'Welcome!']);
        $this->siteSlides()->create(['type' => 'carousel', 'title' => 'A slide']);

        $this->getJson('/api/site-slides?type=popup')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.title', 'Welcome!');
    }

    public function test_public_feed_defaults_to_carousel_for_an_unknown_type(): void
    {
        $this->siteSlides()->create(['type' => 'carousel', 'title' => 'A slide']);

        $this->getJson('/api/site-slides?type=banana')
            ->assertOk()
            ->assertJsonPath('0.title', 'A slide');
    }

    // ── Admin: create ─────────────────────────────────────────────────

    public function test_admin_can_upload_a_slide_and_the_file_is_stored(): void
    {
        $this->actingAsRole('admin');

        $res = $this->post('/api/admin/site-slides', [
            'type'    => 'carousel',
            'title'   => 'Opening Ceremony',
            'caption' => 'Intramurals 2026',
            'image'   => $this->pngUpload(),
        ])->assertCreated()->assertJsonPath('title', 'Opening Ceremony');

        $slide = SiteSlide::firstOrFail();
        $this->assertSame('carousel', $slide->type);
        $this->assertTrue($slide->active);
        Storage::disk('public')->assertExists($slide->image_path);
        $this->assertStringContainsString('/storage/site_slides/', $res->json('imageUrl'));
    }

    public function test_upload_rejects_a_non_image_file(): void
    {
        $this->actingAsRole('admin');

        $this->post('/api/admin/site-slides', [
            'type'  => 'carousel',
            'image' => UploadedFile::fake()->create('payload.pdf', 12, 'application/pdf'),
        ])->assertStatus(422)->assertJsonValidationErrors('image');
    }

    public function test_new_slides_are_appended_to_the_end_of_the_order(): void
    {
        $this->actingAsRole('admin');
        $this->siteSlides()->create(['type' => 'carousel', 'sort_order' => 5]);

        $this->post('/api/admin/site-slides', ['type' => 'carousel', 'image' => $this->pngUpload()])
            ->assertCreated()
            ->assertJsonPath('sortOrder', 6);
    }

    // ── Admin: guardrails ─────────────────────────────────────────────

    public function test_a_coach_cannot_manage_site_slides(): void
    {
        $this->actingAsRole('coach');

        $this->getJson('/api/admin/site-slides')->assertForbidden();
        $this->post('/api/admin/site-slides', ['type' => 'carousel', 'image' => $this->pngUpload()])
            ->assertForbidden();
    }

    public function test_guests_cannot_manage_site_slides(): void
    {
        $this->postJson('/api/admin/site-slides', ['type' => 'carousel'])->assertUnauthorized();
    }

    // ── Admin: update / delete / reorder ──────────────────────────────

    public function test_admin_can_hide_a_slide_so_the_public_stops_seeing_it(): void
    {
        $this->actingAsRole('admin');
        $slide = $this->siteSlides()->create(['type' => 'carousel', 'title' => 'Temp']);

        $this->putJson("/api/admin/site-slides/{$slide->id}", ['active' => false])
            ->assertOk()
            ->assertJsonPath('active', false);

        $this->getJson('/api/site-slides?type=carousel')->assertOk()->assertJsonCount(0);
    }

    public function test_replacing_the_image_deletes_the_old_file(): void
    {
        $this->actingAsRole('admin');

        $created = $this->post('/api/admin/site-slides', [
            'type' => 'carousel', 'image' => $this->pngUpload('old.png'),
        ])->assertCreated();
        $oldPath = SiteSlide::firstOrFail()->image_path;
        Storage::disk('public')->assertExists($oldPath);

        // multipart PUT → POST + _method spoof
        $this->post("/api/admin/site-slides/{$created->json('id')}", [
            '_method' => 'PUT',
            'image'   => $this->pngUpload('new.png'),
        ])->assertOk();

        Storage::disk('public')->assertMissing($oldPath);
        Storage::disk('public')->assertExists(SiteSlide::firstOrFail()->image_path);
    }

    public function test_deleting_a_slide_also_removes_its_file(): void
    {
        $this->actingAsRole('admin');
        $this->post('/api/admin/site-slides', ['type' => 'carousel', 'image' => $this->pngUpload()])->assertCreated();
        $slide = SiteSlide::firstOrFail();

        $this->deleteJson("/api/admin/site-slides/{$slide->id}")->assertOk();

        $this->assertDatabaseCount('site_slides', 0);
        Storage::disk('public')->assertMissing($slide->image_path);
    }

    public function test_admin_can_reorder_the_slideshow(): void
    {
        $this->actingAsRole('admin');
        $a = $this->siteSlides()->create(['type' => 'carousel', 'title' => 'A', 'sort_order' => 0]);
        $b = $this->siteSlides()->create(['type' => 'carousel', 'title' => 'B', 'sort_order' => 1]);
        $c = $this->siteSlides()->create(['type' => 'carousel', 'title' => 'C', 'sort_order' => 2]);

        $this->postJson('/api/admin/site-slides/reorder', [
            'type'  => 'carousel',
            'order' => [$c->id, $a->id, $b->id],
        ])->assertOk();

        $titles = array_column($this->getJson('/api/site-slides?type=carousel')->json(), 'title');
        $this->assertSame(['C', 'A', 'B'], $titles);
    }
}
