<?php

namespace Tests\Feature;

use App\Models\Requirement;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Athlete requirement submissions + coach review.
 *
 * Security focus: uploads are restricted to safe document/image types and a
 * 10 MB cap with a server-generated filename; a coach can only review
 * requirements belonging to their own roster.
 */
class RequirementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    public function test_submitting_a_requirement_requires_an_athlete(): void
    {
        $this->postJson('/api/requirements', [])->assertUnauthorized();

        $this->actingAsRole('coach');
        $this->postJson('/api/requirements', [])->assertForbidden();
    }

    public function test_athlete_can_upload_a_pdf_requirement(): void
    {
        $athlete = $this->actingAsRole('athlete', ['email' => 'sam@example.com']);

        $res = $this->post('/api/requirements', [
            'type' => 'waiver',
            'name' => 'Signed Waiver',
            'file' => UploadedFile::fake()->create('waiver.pdf', 200, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $req = Requirement::first();
        $this->assertNotNull($req);
        $this->assertSame('pending', $req->status);
        // Filename is randomised (not the client's "waiver.pdf").
        $this->assertStringNotContainsString('waiver.pdf', (string) $req->file_url);
        $this->assertStringEndsWith('.pdf', (string) $req->file_url);
    }

    public function test_executable_and_svg_uploads_are_rejected(): void
    {
        $this->actingAsRole('athlete');

        foreach (['shell.php', 'x.svg', 'x.html', 'x.exe'] as $bad) {
            $this->post('/api/requirements', [
                'type' => 'waiver',
                'name' => 'Bad',
                'file' => UploadedFile::fake()->create($bad, 10),
            ], ['Accept' => 'application/json'])
                ->assertStatus(422)
                ->assertJsonValidationErrors('file');
        }

        $this->assertDatabaseCount('requirements', 0);
    }

    public function test_uploads_over_10mb_are_rejected(): void
    {
        $this->actingAsRole('athlete');

        $this->post('/api/requirements', [
            'type' => 'waiver',
            'name' => 'Huge',
            'file' => UploadedFile::fake()->create('huge.pdf', 11 * 1024, 'application/pdf'), // 11 MB
        ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('file');
    }

    public function test_type_name_and_file_are_required(): void
    {
        $this->actingAsRole('athlete');

        $this->postJson('/api/requirements', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['type', 'name', 'file']);
    }

    public function test_coach_can_review_a_requirement_for_their_own_roster(): void
    {
        $coach   = $this->actingAsRole('coach');
        $athlete = $this->athletes()->create(['coach_id' => $coach->id]);
        $req     = $this->requirements()->create(['athlete_id' => $athlete->id]);

        $this->putJson("/api/requirements/{$req->id}/status", ['status' => 'approved', 'notes' => 'Looks good'])
            ->assertOk();

        $this->assertDatabaseHas('requirements', [
            'id'          => $req->id,
            'status'      => 'approved',
            'reviewed_by' => $coach->id,
        ]);
    }

    public function test_coach_cannot_review_a_requirement_outside_their_roster(): void
    {
        $this->actingAsRole('coach');
        $otherCoach = $this->users()->coach()->create();
        $athlete    = $this->athletes()->create(['coach_id' => $otherCoach->id]);
        $req        = $this->requirements()->create(['athlete_id' => $athlete->id, 'status' => 'pending']);

        $this->putJson("/api/requirements/{$req->id}/status", ['status' => 'approved'])
            ->assertNotFound();

        $this->assertSame('pending', $req->fresh()->status);
    }

    public function test_review_status_must_be_valid(): void
    {
        $coach   = $this->actingAsRole('coach');
        $athlete = $this->athletes()->create(['coach_id' => $coach->id]);
        $req     = $this->requirements()->create(['athlete_id' => $athlete->id]);

        $this->putJson("/api/requirements/{$req->id}/status", ['status' => 'maybe'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }
}
