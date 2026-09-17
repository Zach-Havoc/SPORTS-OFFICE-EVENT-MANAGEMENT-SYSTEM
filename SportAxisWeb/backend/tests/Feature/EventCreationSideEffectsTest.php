<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Event;
use App\Models\Season;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * POST /api/events — coverage beyond tests/Feature/EventTest.php:
 * authorization for every non-admin role, the taxonomy/season side effects
 * (season_id, category_id, event_department pivot), the audit trail, and
 * a few validation edges the existing suite doesn't exercise.
 */
class EventCreationSideEffectsTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $over = []): array
    {
        return array_merge([
            'name' => 'Opening Game',
            'category' => 'Basketball',
            'schedule' => now()->addDay()->toDateString(),
            'startTime' => '09:00',
            'endTime' => '11:00',
            'departments' => ['College of Engineering', 'College of Business'],
        ], $over);
    }

    // ── Authorization: every non-admin role, not just "some role" ─────────

    public function test_judge_cannot_create_an_event(): void
    {
        $this->actingAsRole('judge');

        $this->postJson('/api/events', $this->payload())->assertForbidden();
        $this->assertSame(0, Event::count());
    }

    public function test_athlete_cannot_create_an_event(): void
    {
        $this->actingAsRole('athlete');

        $this->postJson('/api/events', $this->payload())->assertForbidden();
        $this->assertSame(0, Event::count());
    }

    // ── Side effects on the happy path ─────────────────────────────────────

    public function test_created_event_is_attached_to_the_active_season(): void
    {
        // A default active season already exists at this point — it's seeded by
        // the 2026_09_10_000002_add_season_id_to_events_and_brackets migration
        // and persists into every test's transaction. Deactivate it and make a
        // fresh one active so this test isn't coupled to that seeded row.
        $this->actingAsRole('admin');
        Season::query()->update(['is_active' => false]);
        $season = Season::create([
            'id' => (string) Str::uuid(),
            'name' => 'Active Edition',
            'is_active' => true,
        ]);

        $res = $this->postJson('/api/events', $this->payload())->assertCreated();

        $this->assertSame($season->id, $res->json('seasonId'));
        $this->assertDatabaseHas('events', ['id' => $res->json('id'), 'season_id' => $season->id]);
    }

    public function test_created_event_has_no_season_when_none_is_active(): void
    {
        $this->actingAsRole('admin');
        // Deactivate the default season seeded by the migration referenced above
        // so Season::current() genuinely returns null for this test.
        Season::query()->update(['is_active' => false]);
        $this->assertNull(Season::current());

        $res = $this->postJson('/api/events', $this->payload())->assertCreated();

        $this->assertNull($res->json('seasonId'));
    }

    public function test_created_event_syncs_category_id_from_the_category_name(): void
    {
        $this->actingAsRole('admin');
        $category = $this->categories()->create(['name' => 'Basketball']);

        $res = $this->postJson('/api/events', $this->payload(['category' => 'Basketball']))->assertCreated();

        $this->assertDatabaseHas('events', ['id' => $res->json('id'), 'category_id' => $category->id]);
    }

    public function test_created_event_leaves_category_id_null_when_the_sport_is_not_seeded(): void
    {
        $this->actingAsRole('admin');
        // No Category row named "Basketball" exists in this test.

        $res = $this->postJson('/api/events', $this->payload())->assertCreated();

        $this->assertDatabaseHas('events', ['id' => $res->json('id'), 'category_id' => null]);
    }

    public function test_created_event_syncs_the_event_department_pivot_by_name_or_abbreviation(): void
    {
        $this->actingAsRole('admin');
        $cet = $this->departments()->create(['name' => 'College of Engineering and Technology', 'abbreviation' => 'CET']);
        $cics = $this->departments()->create(['name' => 'College of Information and Computing Sciences', 'abbreviation' => 'CICS']);

        $res = $this->postJson('/api/events', $this->payload(['departments' => ['CET', 'College of Information and Computing Sciences']]))
            ->assertCreated();

        $pivotDeptIds = DB::table('event_department')->where('event_id', $res->json('id'))->pluck('department_id');
        $this->assertEqualsCanonicalizing([$cet->id, $cics->id], $pivotDeptIds->all());
    }

    public function test_created_event_has_no_pivot_rows_when_no_department_names_match(): void
    {
        $this->actingAsRole('admin');
        // "College of Engineering" / "College of Business" (the default payload)
        // do not match any seeded Department row in this test.

        $res = $this->postJson('/api/events', $this->payload())->assertCreated();

        $this->assertSame(0, DB::table('event_department')->where('event_id', $res->json('id'))->count());
    }

    public function test_creating_an_event_writes_a_created_audit_log_entry(): void
    {
        $admin = $this->actingAsRole('admin');

        $res = $this->postJson('/api/events', $this->payload(['name' => 'Audited Match']))->assertCreated();

        $log = AuditLog::where('auditable_type', (new Event)->getMorphClass())
            ->where('auditable_id', $res->json('id'))
            ->where('event', 'created')
            ->first();

        $this->assertNotNull($log, 'Expected a "created" audit_logs row for the new event.');
        $this->assertSame($admin->id, $log->user_id);
        $this->assertSame('Audited Match', $log->new_values['name'] ?? null);
    }

    // ── Validation edges not covered by EventTest ──────────────────────────

    public function test_an_unparseable_schedule_date_is_rejected(): void
    {
        $this->actingAsRole('admin');

        $this->postJson('/api/events', $this->payload(['schedule' => 'not-a-date']))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['schedule']);
    }

    public function test_departments_must_be_an_array_not_a_string(): void
    {
        $this->actingAsRole('admin');

        $this->postJson('/api/events', $this->payload(['departments' => 'College of Engineering']))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['departments']);
    }

    /**
     * The admin UI refuses to submit an event whose end time is not after its
     * start time (see src/app/pages/admin/EventsEnhanced.tsx, the
     * `timeToMinutes(data.startTime) >= timeToMinutes(data.endTime)` guard).
     * EventController::store has no equivalent server-side check, so a
     * direct API call can create an inverted-time event. This test encodes
     * the rule the UI already enforces and is expected to fail against the
     * current controller — see report.
     */
    public function test_end_time_before_start_time_is_rejected(): void
    {
        $this->actingAsRole('admin');

        $this->postJson('/api/events', $this->payload(['startTime' => '11:00', 'endTime' => '09:00']))
            ->assertStatus(422);
    }

    public function test_duplicate_event_names_are_currently_allowed(): void
    {
        // `events.name` has no unique constraint (see the create_sportsaxis_tables
        // migration) and EventController::store performs no duplicate-name check.
        // This documents that as current behavior, not an oversight in the test.
        $this->actingAsRole('admin');
        $this->postJson('/api/events', $this->payload(['name' => 'Rematch']))->assertCreated();

        $this->postJson('/api/events', $this->payload(['name' => 'Rematch']))->assertCreated();

        $this->assertSame(2, Event::where('name', 'Rematch')->count());
    }

    public function test_a_soft_deleted_event_does_not_block_a_new_booking_in_its_slot(): void
    {
        $this->actingAsRole('admin');
        $this->venues()->create(['id' => 'gym-1', 'name' => 'Joson Gym']);
        $trashed = $this->events()->create([
            'schedule' => '2026-10-01', 'start_time' => '20:00', 'end_time' => '21:00',
            'venue_id' => 'gym-1', 'venue_name' => 'Joson Gym',
        ]);
        $trashed->delete();

        $this->postJson('/api/events', $this->payload([
            'name' => 'Replacement', 'schedule' => '2026-10-01',
            'startTime' => '20:00', 'endTime' => '21:00', 'venueId' => 'gym-1',
        ]))->assertCreated();
    }

    public function test_a_ranked_sport_rejects_the_same_college_listed_twice(): void
    {
        // array_unique in rosterError() collapses ['CET', 'CET'] to one entry,
        // which then fails the "at least two colleges" rule.
        $this->actingAsRole('admin');
        $this->categories()->create(['name' => 'Swimming', 'format' => 'ranked']);

        $this->postJson('/api/events', $this->payload([
            'category' => 'Swimming', 'departments' => ['CET', 'CET'],
        ]))
            ->assertStatus(422)
            ->assertJsonPath('error', 'Pick at least two colleges.');
    }

    public function test_an_unknown_venue_id_falls_back_to_the_supplied_venue_name(): void
    {
        $this->actingAsRole('admin');

        $res = $this->postJson('/api/events', $this->payload([
            'venueId' => 'does-not-exist', 'venueName' => 'Backup Court',
        ]))->assertCreated();

        $this->assertSame('Backup Court', $res->json('venueName'));
        $this->assertDatabaseHas('events', ['id' => $res->json('id'), 'venue_name' => 'Backup Court']);
    }
}
