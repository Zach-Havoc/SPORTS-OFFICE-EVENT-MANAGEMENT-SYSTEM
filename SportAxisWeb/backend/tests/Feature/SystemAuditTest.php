<?php

namespace Tests\Feature;

use App\Models\PerformanceRecord;
use App\Models\Requirement;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Endpoints and edge cases the rest of the suite never reaches:
 * the public QR event lookup, /judges, and the two athlete-facing
 * "my records" endpoints — plus the validation holes found while auditing.
 */
class SystemAuditTest extends TestCase
{
    use RefreshDatabase;

    // ── GET /api/event/session/{qrToken} — public QR scoring entry ────────

    public function test_qr_lookup_returns_the_event_for_a_valid_token(): void
    {
        $event = $this->events()->create(['qr_token' => 'VALIDTOKEN123', 'name' => 'Finals']);

        $this->getJson('/api/event/session/VALIDTOKEN123')
            ->assertOk()
            ->assertJsonPath('event.id', $event->id)
            ->assertJsonPath('event.name', 'Finals');
    }

    public function test_qr_lookup_rejects_an_unknown_token(): void
    {
        $this->getJson('/api/event/session/NOPE')
            ->assertNotFound()
            ->assertJsonPath('code', 'INVALID_QR_TOKEN');
    }

    public function test_qr_lookup_refuses_a_completed_event(): void
    {
        $this->events()->create(['qr_token' => 'DONETOKEN', 'status' => 'completed']);

        $this->getJson('/api/event/session/DONETOKEN')
            ->assertStatus(422)
            ->assertJsonPath('code', 'EVENT_COMPLETED');
    }

    public function test_qr_lookup_does_not_leak_judge_contact_details(): void
    {
        $this->events()->create([
            'qr_token' => 'LEAKTEST',
            'judges' => [['id' => 'j-1', 'name' => 'Judge Ann', 'email' => 'ann@private.edu']],
        ]);

        $body = $this->getJson('/api/event/session/LEAKTEST')->assertOk()->getContent();

        $this->assertStringNotContainsString('ann@private.edu', $body);
    }

    // ── GET /api/judges ──────────────────────────────────────────────────

    public function test_judge_list_requires_authentication(): void
    {
        $this->getJson('/api/judges')->assertUnauthorized();
    }

    public function test_judge_list_returns_only_judges_and_never_passwords(): void
    {
        $this->users()->judge()->create(['name' => 'Ref One']);
        $this->users()->coach()->create(['name' => 'Not A Ref']);
        $this->actingAsRole('admin');

        $res = $this->getJson('/api/judges')->assertOk();

        $names = collect($res->json())->pluck('name');
        $this->assertTrue($names->contains('Ref One'));
        $this->assertFalse($names->contains('Not A Ref'));
        $this->assertStringNotContainsString('password', $res->getContent());
    }

    // ── GET /api/performance/my ──────────────────────────────────────────

    public function test_my_performance_returns_only_the_callers_records(): void
    {
        $account = $this->users()->athlete()->create(['email' => 'me@student.edu']);
        $mine = $this->athletes()->create(['user_id' => $account->id, 'email' => 'me@student.edu']);
        $someoneElse = $this->athletes()->create(['email' => 'other@student.edu']);

        PerformanceRecord::create([
            'id' => (string) Str::uuid(), 'athlete_id' => $mine->id,
            'athlete_name' => 'Me', 'overall_rating' => 9, 'recorded_by' => $account->id,
            'recorded_at' => now(),
        ]);
        PerformanceRecord::create([
            'id' => (string) Str::uuid(), 'athlete_id' => $someoneElse->id,
            'athlete_name' => 'Them', 'overall_rating' => 3, 'recorded_by' => $account->id,
            'recorded_at' => now(),
        ]);

        $this->loginAs($account);
        $res = $this->getJson('/api/performance/my')->assertOk();

        $this->assertCount(1, $res->json());
        $this->assertSame('Me', $res->json('0.athlete_name'));
    }

    /**
     * The roster row is linked by `user_id`, but its denormalised `email`
     * column has drifted from the account. Resolution must follow the link.
     */
    public function test_my_performance_follows_the_account_link_not_a_stale_email(): void
    {
        $account = $this->users()->athlete()->create(['email' => 'current@student.edu']);
        $athlete = $this->athletes()->create([
            'user_id' => $account->id,
            'email' => 'old-address@student.edu',
        ]);

        PerformanceRecord::create([
            'id' => (string) Str::uuid(), 'athlete_id' => $athlete->id,
            'athlete_name' => 'Linked', 'overall_rating' => 8, 'recorded_by' => $account->id,
            'recorded_at' => now(),
        ]);

        $this->loginAs($account);

        $this->getJson('/api/performance/my')->assertOk()->assertJsonCount(1);
    }

    // ── GET /api/requirements/my ─────────────────────────────────────────

    public function test_my_requirements_follows_the_account_link_not_a_stale_email(): void
    {
        $account = $this->users()->athlete()->create(['email' => 'current2@student.edu']);
        $athlete = $this->athletes()->create([
            'user_id' => $account->id,
            'email' => 'stale2@student.edu',
        ]);

        Requirement::create([
            'id' => (string) Str::uuid(), 'athlete_id' => $athlete->id,
            'athlete_name' => 'Linked', 'type' => 'medical', 'name' => 'Clearance',
            'status' => 'pending', 'submitted_at' => now(),
        ]);

        $this->loginAs($account);

        $this->getJson('/api/requirements/my')->assertOk()->assertJsonCount(1);
    }

    // ── Validation holes ─────────────────────────────────────────────────

    public function test_venue_update_rejects_an_invalid_status(): void
    {
        $this->actingAsRole('admin');
        $venue = $this->venues()->create();

        $this->putJson("/api/venues/{$venue->id}", ['status' => 'exploded'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    public function test_venue_update_rejects_a_negative_capacity(): void
    {
        $this->actingAsRole('admin');
        $venue = $this->venues()->create(['capacity' => 100]);

        $this->putJson("/api/venues/{$venue->id}", ['capacity' => -5])
            ->assertStatus(422)
            ->assertJsonValidationErrors('capacity');

        $this->assertSame(100, $venue->fresh()->capacity);
    }

    public function test_announcement_update_cannot_blank_a_required_field(): void
    {
        $coach = $this->actingAsRole('coach');
        $ann = $this->announcements()->create(['coach_id' => $coach->id, 'title' => 'Real title']);

        $this->putJson("/api/announcements/{$ann->id}", ['title' => ''])
            ->assertStatus(422)
            ->assertJsonValidationErrors('title');

        $this->assertSame('Real title', $ann->fresh()->title);
    }
}
