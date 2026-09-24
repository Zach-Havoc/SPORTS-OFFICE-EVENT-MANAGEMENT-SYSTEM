<?php

namespace Tests\Feature;

use App\Models\CmoApplication;
use App\Notifications\CmoApplicationReviewed;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * CMO application submissions (athlete) + admin review — distinct from the
 * coach-reviewed Requirement checklist: only an admin may review these.
 */
class CmoApplicationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    public function test_submitting_requires_an_athlete(): void
    {
        $this->postJson('/api/cmo-applications', [])->assertUnauthorized();

        $this->actingAsRole('coach');
        $this->postJson('/api/cmo-applications', [])->assertForbidden();
    }

    public function test_athlete_can_submit_an_application_without_a_file(): void
    {
        $this->actingAsRole('athlete');

        $res = $this->postJson('/api/cmo-applications', [
            'cmoReference' => 'CMO No. 21, s. 2021',
            'schoolYear' => '2025-2026',
            'purpose' => 'Athletic scholarship renewal',
        ])->assertCreated();

        $app = CmoApplication::first();
        $this->assertNotNull($app);
        $this->assertSame('pending', $app->status);
        $this->assertStringStartsWith('CMO-2025-2026-', $app->reference_no);
        $this->assertNull($app->file_url);
    }

    public function test_athlete_can_attach_a_supporting_file(): void
    {
        $this->actingAsRole('athlete');

        $res = $this->post('/api/cmo-applications', [
            'cmoReference' => 'CMO No. 21, s. 2021',
            'schoolYear' => '2025-2026',
            'purpose' => 'Cross-enrollment permit',
            'file' => UploadedFile::fake()->create('permit.pdf', 200, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $app = CmoApplication::first();
        $this->assertStringEndsWith('.pdf', (string) $app->file_url);
        // Filename is randomised, not the client's "permit.pdf".
        $this->assertStringNotContainsString('permit.pdf', (string) $app->file_url);
    }

    public function test_executable_uploads_are_rejected(): void
    {
        $this->actingAsRole('athlete');

        $this->post('/api/cmo-applications', [
            'cmoReference' => 'CMO No. 21, s. 2021',
            'schoolYear' => '2025-2026',
            'purpose' => 'Test',
            'file' => UploadedFile::fake()->create('shell.php', 10),
        ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('file');

        $this->assertDatabaseCount('cmo_applications', 0);
    }

    public function test_cmo_reference_school_year_and_purpose_are_required(): void
    {
        $this->actingAsRole('athlete');

        $this->postJson('/api/cmo-applications', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['cmoReference', 'schoolYear', 'purpose']);
    }

    public function test_coach_cannot_review_a_cmo_application(): void
    {
        $this->actingAsRole('coach');
        $athlete = $this->athletes()->create();
        $app = CmoApplication::create([
            'id' => Str::uuid(),
            'athlete_id' => $athlete->id,
            'athlete_name' => $athlete->first_name.' '.$athlete->last_name,
            'reference_no' => 'CMO-2025-2026-000001',
            'cmo_reference' => 'CMO No. 21, s. 2021',
            'school_year' => '2025-2026',
            'purpose' => 'Test',
            'status' => 'pending',
            'submitted_at' => now(),
        ]);

        $this->putJson("/api/cmo-applications/{$app->id}/status", ['status' => 'approved'])
            ->assertForbidden();
        $this->getJson('/api/cmo-applications')->assertForbidden();
    }

    public function test_admin_can_approve_and_the_athlete_is_notified(): void
    {
        Notification::fake();

        $this->actingAsRole('admin');
        $athlete = $this->athletes()->create();
        $app = CmoApplication::create([
            'id' => Str::uuid(),
            'athlete_id' => $athlete->id,
            'athlete_name' => $athlete->first_name.' '.$athlete->last_name,
            'reference_no' => 'CMO-2025-2026-000002',
            'cmo_reference' => 'CMO No. 21, s. 2021',
            'school_year' => '2025-2026',
            'purpose' => 'Test',
            'status' => 'pending',
            'submitted_at' => now(),
        ]);

        $this->putJson("/api/cmo-applications/{$app->id}/status", [
            'status' => 'approved',
            'notes' => 'All documents in order',
        ])->assertOk();

        $this->assertDatabaseHas('cmo_applications', [
            'id' => $app->id,
            'status' => 'approved',
        ]);

        if ($athlete->account) {
            Notification::assertSentTo($athlete->account, CmoApplicationReviewed::class);
        }
    }

    public function test_review_status_must_be_valid(): void
    {
        $this->actingAsRole('admin');
        $athlete = $this->athletes()->create();
        $app = CmoApplication::create([
            'id' => Str::uuid(),
            'athlete_id' => $athlete->id,
            'athlete_name' => 'Test Athlete',
            'reference_no' => 'CMO-2025-2026-000003',
            'cmo_reference' => 'CMO No. 21, s. 2021',
            'school_year' => '2025-2026',
            'purpose' => 'Test',
            'status' => 'pending',
            'submitted_at' => now(),
        ]);

        $this->putJson("/api/cmo-applications/{$app->id}/status", ['status' => 'maybe'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }
}
