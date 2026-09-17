<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * College logos for the standings board.
 *   POST   /api/departments/{id}/logo   (admin, multipart: logo)
 *   DELETE /api/departments/{id}/logo   (admin)
 */
class DepartmentLogoTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    private function pngFile(): UploadedFile
    {
        $img = imagecreatetruecolor(48, 48);
        ob_start();
        imagepng($img);
        $bytes = (string) ob_get_clean();
        imagedestroy($img);

        return UploadedFile::fake()->createWithContent('logo.png', $bytes);
    }

    public function test_admin_can_upload_a_college_logo(): void
    {
        $this->actingAsRole('admin');
        $dept = $this->departments()->create();

        $this->post("/api/departments/{$dept->id}/logo", ['logo' => $this->pngFile()], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('id', $dept->id);

        $dept->refresh();
        $this->assertNotNull($dept->logo_url);
        $this->assertNotEmpty(Storage::disk('public')->files('department_logos'));
    }

    public function test_a_non_image_upload_is_rejected(): void
    {
        $this->actingAsRole('admin');
        $dept = $this->departments()->create();

        $this->post("/api/departments/{$dept->id}/logo", [
            'logo' => UploadedFile::fake()->create('notes.pdf', 8, 'application/pdf'),
        ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('logo');
    }

    public function test_a_non_admin_cannot_upload_a_logo(): void
    {
        $this->actingAsRole('coach');
        $dept = $this->departments()->create();

        $this->post("/api/departments/{$dept->id}/logo", ['logo' => $this->pngFile()], ['Accept' => 'application/json'])
            ->assertForbidden();
    }

    public function test_admin_can_remove_a_logo(): void
    {
        $this->actingAsRole('admin');
        $dept = $this->departments()->create();
        $this->post("/api/departments/{$dept->id}/logo", ['logo' => $this->pngFile()], ['Accept' => 'application/json'])->assertOk();

        $this->deleteJson("/api/departments/{$dept->id}/logo")->assertOk()->assertJsonPath('logo_url', null);

        $this->assertNull($dept->fresh()->logo_url);
        $this->assertEmpty(Storage::disk('public')->files('department_logos'));
    }
}
