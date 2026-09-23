<?php

namespace Tests\Feature;

use App\Models\Event;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Events:
 *   GET    /api/events            (public, ordered, optional ?date= filter)
 *   GET    /api/events/{id}       (public)
 *   POST   /api/events            (admin)
 *   PUT    /api/events/{id}       (admin)
 *   DELETE /api/events/{id}       (admin)
 */
class EventTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->venues()->create(['id' => 'gym-1', 'name' => 'Joson Gym']);
        $this->venues()->create(['id' => 'pool-1', 'name' => 'Aquatic Center']);
    }

    public function test_event_list_is_public_and_sorted_by_schedule(): void
    {
        $this->events()->create(['name' => 'Later',  'schedule' => now()->addDays(10)->toDateString()]);
        $this->events()->create(['name' => 'Sooner', 'schedule' => now()->addDays(2)->toDateString()]);

        $names = $this->getJson('/api/events')->assertOk()->json('data.*.name');

        $this->assertSame(['Sooner', 'Later'], $names);
    }

    public function test_event_list_can_be_filtered_by_date(): void
    {
        $target = now()->addDays(5)->toDateString();
        $this->events()->create(['name' => 'On target', 'schedule' => $target]);
        $this->events()->create(['name' => 'Other day', 'schedule' => now()->addDays(6)->toDateString()]);

        $this->getJson('/api/events?date='.$target)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonFragment(['name' => 'On target']);
    }

    public function test_showing_a_single_event_returns_the_api_shape(): void
    {
        $event = $this->events()->create();

        $this->getJson("/api/events/{$event->id}")
            ->assertOk()
            ->assertJsonStructure(['id', 'name', 'category', 'schedule', 'startTime', 'endTime', 'departments', 'status', 'qrToken']);
    }

    public function test_public_event_endpoints_never_expose_a_judges_email(): void
    {
        $event = $this->events()->create([
            'judges' => [
                ['id' => 'j1', 'name' => 'Judge One', 'email' => 'judge-one@example.com'],
                ['id' => 'j2', 'name' => 'Judge Two', 'email' => 'judge-two@example.com'],
            ],
        ]);

        $list = $this->getJson('/api/events')->assertOk();
        $show = $this->getJson("/api/events/{$event->id}")->assertOk();

        $listJudges = $list->json('data.0.judges');
        $this->assertNotEmpty($listJudges);
        foreach ($listJudges as $judge) {
            $this->assertArrayHasKey('id', $judge);
            $this->assertArrayHasKey('name', $judge);
            $this->assertArrayNotHasKey('email', $judge);
        }

        $showJudges = $show->json('judges');
        $this->assertNotEmpty($showJudges);
        foreach ($showJudges as $judge) {
            $this->assertArrayHasKey('id', $judge);
            $this->assertArrayHasKey('name', $judge);
            $this->assertArrayNotHasKey('email', $judge);
        }

        $this->assertStringNotContainsString('judge-one@example.com', $list->getContent());
        $this->assertStringNotContainsString('judge-two@example.com', $list->getContent());
        $this->assertStringNotContainsString('judge-one@example.com', $show->getContent());
        $this->assertStringNotContainsString('judge-two@example.com', $show->getContent());
    }

    public function test_showing_a_missing_event_returns_404(): void
    {
        $this->getJson('/api/events/does-not-exist')->assertNotFound();
    }

    public function test_creating_an_event_requires_an_admin(): void
    {
        $payload = [
            'name' => 'X', 'category' => 'Basketball', 'schedule' => now()->addDay()->toDateString(),
            'startTime' => '09:00', 'endTime' => '11:00', 'departments' => ['A', 'B'],
        ];

        $this->postJson('/api/events', $payload)->assertUnauthorized();

        $this->actingAsRole('coach');
        $this->postJson('/api/events', $payload)->assertForbidden();
    }

    public function test_admin_can_create_an_event(): void
    {
        $this->actingAsRole('admin');

        $res = $this->postJson('/api/events', [
            'name' => 'Finals',
            'category' => 'Basketball',
            'schedule' => now()->addDay()->toDateString(),
            'startTime' => '09:00',
            'endTime' => '11:00',
            'departments' => ['College of Engineering', 'College of Business'],
        ])->assertCreated();

        $this->assertNotEmpty($res->json('qrToken'));
        $this->assertDatabaseHas('events', ['name' => 'Finals', 'status' => 'upcoming']);
    }

    // ── Roster must fit how the sport is contested ────────────────────────

    private function eventPayload(array $over = []): array
    {
        return array_merge([
            'name' => 'Game',
            'category' => 'Basketball',
            'schedule' => now()->addDay()->toDateString(),
            'startTime' => '09:00',
            'endTime' => '11:00',
            'departments' => ['CET', 'CICS'],
        ], $over);
    }

    public function test_a_versus_sport_rejects_an_event_with_more_than_two_colleges(): void
    {
        $this->actingAsRole('admin');
        $this->categories()->create(['name' => 'Basketball', 'format' => 'versus']);

        $this->postJson('/api/events', $this->eventPayload([
            'departments' => ['CET', 'CICS', 'CABEIHM'],
        ]))->assertStatus(422)->assertJsonPath('error', 'Two-team sport — pick exactly two colleges.');
    }

    public function test_a_versus_sport_rejects_an_event_with_one_college(): void
    {
        $this->actingAsRole('admin');
        $this->categories()->create(['name' => 'Basketball', 'format' => 'versus']);

        $this->postJson('/api/events', $this->eventPayload(['departments' => ['CET']]))
            ->assertStatus(422)
            ->assertJsonPath('error', 'Two-team sport — pick exactly two colleges.');
    }

    public function test_a_versus_sport_accepts_exactly_two_colleges(): void
    {
        $this->actingAsRole('admin');
        $this->categories()->create(['name' => 'Basketball', 'format' => 'versus']);

        $this->postJson('/api/events', $this->eventPayload())->assertCreated();
    }

    public function test_a_ranked_sport_accepts_many_colleges(): void
    {
        $this->actingAsRole('admin');
        $this->categories()->create(['name' => 'Swimming 50m Free', 'format' => 'ranked']);

        $this->postJson('/api/events', $this->eventPayload([
            'category' => 'Swimming 50m Free',
            'departments' => ['CET', 'CICS', 'CABEIHM', 'CAS'],
        ]))->assertCreated();
    }

    public function test_editing_a_versus_event_onto_a_third_college_is_rejected(): void
    {
        $this->actingAsRole('admin');
        $this->categories()->create(['name' => 'Basketball', 'format' => 'versus']);
        $event = $this->events()->create(['category' => 'Basketball', 'departments' => ['CET', 'CICS']]);

        $this->putJson("/api/events/{$event->id}", ['departments' => ['CET', 'CICS', 'CAS']])
            ->assertStatus(422)
            ->assertJsonPath('error', 'Two-team sport — pick exactly two colleges.');

        // A bare status flip on the same event still works (roster untouched).
        $this->putJson("/api/events/{$event->id}", ['status' => 'ongoing'])->assertOk();
    }

    public function test_event_creation_validates_required_fields_and_status(): void
    {
        $this->actingAsRole('admin');

        $this->postJson('/api/events', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'category', 'schedule', 'startTime', 'endTime', 'departments']);

        $this->postJson('/api/events', [
            'name' => 'X', 'category' => 'Basketball', 'schedule' => now()->addDay()->toDateString(),
            'startTime' => '09:00', 'endTime' => '11:00', 'departments' => ['A'], 'status' => 'bogus',
        ])->assertStatus(422)->assertJsonValidationErrors('status');
    }

    public function test_admin_can_update_and_delete_an_event(): void
    {
        $this->actingAsRole('admin');
        $event = $this->events()->create(['name' => 'Original', 'status' => 'upcoming']);

        $this->putJson("/api/events/{$event->id}", ['status' => 'ongoing'])->assertOk();
        $this->assertDatabaseHas('events', ['id' => $event->id, 'status' => 'ongoing']);

        $this->deleteJson("/api/events/{$event->id}")->assertOk();
        $this->assertSoftDeleted('events', ['id' => $event->id]);
        $this->getJson("/api/events/{$event->id}")->assertNotFound();

        $this->postJson("/api/events/{$event->id}/restore")->assertOk();
        $this->assertNotSoftDeleted('events', ['id' => $event->id]);
    }

    // ── Time window and venue resolution on update ────────────────────────

    public function test_updating_an_event_cannot_invert_its_time_window(): void
    {
        $this->actingAsRole('admin');
        $event = $this->events()->create([
            'start_time' => '09:00',
            'end_time' => '11:00',
        ]);

        // Sending only endTime is still checked against the stored startTime.
        $this->putJson("/api/events/{$event->id}", ['endTime' => '08:00'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('endTime');

        // …and sending only startTime against the stored endTime.
        $this->putJson("/api/events/{$event->id}", ['startTime' => '12:00'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('startTime');

        // Equal start and end is a zero-length event, also rejected.
        $this->putJson("/api/events/{$event->id}", ['startTime' => '10:00', 'endTime' => '10:00'])
            ->assertStatus(422);

        // A valid pair still goes through.
        $this->putJson("/api/events/{$event->id}", ['startTime' => '13:00', 'endTime' => '15:00'])
            ->assertOk();
        $this->assertDatabaseHas('events', [
            'id' => $event->id, 'start_time' => '13:00', 'end_time' => '15:00',
        ]);
    }

    public function test_updating_an_event_with_an_unknown_venue_id_does_not_500(): void
    {
        $this->actingAsRole('admin');
        $event = $this->events()->create(['venue_id' => 'gym-1', 'venue_name' => 'Joson Gym']);

        // events.venue_id is a foreign key: an id that resolves to nothing must
        // be stored as null rather than written raw.
        $this->putJson("/api/events/{$event->id}", ['venueId' => 'no-such-venue'])
            ->assertOk();

        $this->assertDatabaseHas('events', ['id' => $event->id, 'venue_id' => null]);
    }

    public function test_updating_an_event_to_a_real_venue_still_works(): void
    {
        $this->actingAsRole('admin');
        $event = $this->events()->create(['venue_id' => 'gym-1', 'venue_name' => 'Joson Gym']);

        $this->putJson("/api/events/{$event->id}", ['venueId' => 'pool-1'])->assertOk();

        $this->assertDatabaseHas('events', ['id' => $event->id, 'venue_id' => 'pool-1']);
    }

    // ── Venue double-booking ──────────────────────────────────────────────

    public function test_cannot_create_an_event_that_overlaps_another_in_the_same_venue(): void
    {
        $this->actingAsRole('admin');
        $this->events()->create([
            'name' => 'Basketball R1', 'schedule' => '2026-09-10',
            'start_time' => '20:00', 'end_time' => '21:00',
            'venue_id' => 'gym-1', 'venue_name' => 'Joson Gym',
        ]);

        $this->postJson('/api/events', [
            'name' => 'Volleyball R1', 'category' => 'Volleyball', 'schedule' => '2026-09-10',
            'startTime' => '20:30', 'endTime' => '21:30', 'departments' => ['A', 'B'],
            'venueId' => 'gym-1',
        ])
            ->assertStatus(422)
            ->assertJsonPath('conflicts.0.name', 'Basketball R1')
            ->assertJsonFragment(['error' => Event::conflictMessage(
                Event::where('name', 'Basketball R1')->first()
            )]);

        $this->assertDatabaseMissing('events', ['name' => 'Volleyball R1']);
    }

    public function test_back_to_back_bookings_in_the_same_venue_are_allowed(): void
    {
        $this->actingAsRole('admin');
        $this->events()->create([
            'schedule' => '2026-09-10', 'start_time' => '20:00', 'end_time' => '21:00',
            'venue_id' => 'gym-1', 'venue_name' => 'Joson Gym',
        ]);

        $this->postJson('/api/events', [
            'name' => 'Right after', 'category' => 'Basketball', 'schedule' => '2026-09-10',
            'startTime' => '21:00', 'endTime' => '22:00', 'departments' => ['A', 'B'],
            'venueId' => 'gym-1',
        ])->assertCreated();
    }

    public function test_same_time_is_fine_in_a_different_venue_or_on_a_different_day(): void
    {
        $this->actingAsRole('admin');
        $this->events()->create([
            'schedule' => '2026-09-10', 'start_time' => '20:00', 'end_time' => '21:00',
            'venue_id' => 'gym-1', 'venue_name' => 'Joson Gym',
        ]);

        // different venue, same slot
        $this->postJson('/api/events', [
            'name' => 'Elsewhere', 'category' => 'Swimming', 'schedule' => '2026-09-10',
            'startTime' => '20:00', 'endTime' => '21:00', 'departments' => ['A', 'B'],
            'venueId' => 'pool-1',
        ])->assertCreated();

        // same venue, next day
        $this->postJson('/api/events', [
            'name' => 'Tomorrow', 'category' => 'Basketball', 'schedule' => '2026-09-11',
            'startTime' => '20:00', 'endTime' => '21:00', 'departments' => ['A', 'B'],
            'venueId' => 'gym-1',
        ])->assertCreated();
    }

    public function test_events_without_a_venue_never_conflict(): void
    {
        $this->actingAsRole('admin');
        $this->events()->create([
            'schedule' => '2026-09-10', 'start_time' => '20:00', 'end_time' => '21:00',
            'venue_id' => null, 'venue_name' => null,
        ]);

        $this->postJson('/api/events', [
            'name' => 'No venue too', 'category' => 'Basketball', 'schedule' => '2026-09-10',
            'startTime' => '20:00', 'endTime' => '21:00', 'departments' => ['A', 'B'],
        ])->assertCreated();
    }

    public function test_updating_an_event_cannot_move_it_onto_another_booking(): void
    {
        $this->actingAsRole('admin');
        $this->events()->create([
            'name' => 'Fixed', 'schedule' => '2026-09-10', 'start_time' => '20:00', 'end_time' => '21:00',
            'venue_id' => 'gym-1', 'venue_name' => 'Joson Gym',
        ]);
        $moving = $this->events()->create([
            'name' => 'Moving', 'schedule' => '2026-09-10', 'start_time' => '09:00', 'end_time' => '10:00',
            'venue_id' => 'gym-1', 'venue_name' => 'Joson Gym',
        ]);

        $this->putJson("/api/events/{$moving->id}", ['startTime' => '20:15', 'endTime' => '21:15'])
            ->assertStatus(422)
            ->assertJsonPath('conflicts.0.name', 'Fixed');

        // A no-op status change on the same event is still fine (it ignores itself).
        $this->putJson("/api/events/{$moving->id}", ['status' => 'ongoing'])->assertOk();
    }

    // ── Bulk operations ──────────────────────────────────────────────────

    public function test_admin_can_bulk_delete_events_in_one_request(): void
    {
        $this->actingAsRole('admin');
        $a = $this->events()->create();
        $b = $this->events()->create();
        $keep = $this->events()->create();

        $this->postJson('/api/events/bulk-delete', ['ids' => [$a->id, $b->id]])
            ->assertOk()
            ->assertJsonPath('deleted', 2);

        $this->assertSoftDeleted('events', ['id' => $a->id]);
        $this->assertSoftDeleted('events', ['id' => $b->id]);
        $this->assertNotSoftDeleted('events', ['id' => $keep->id]);
        $this->assertSame(1, Event::count());
    }

    public function test_admin_can_bulk_change_status(): void
    {
        $this->actingAsRole('admin');
        $a = $this->events()->create(['status' => 'upcoming']);
        $b = $this->events()->create(['status' => 'upcoming']);

        $this->postJson('/api/events/bulk-status', ['ids' => [$a->id, $b->id], 'status' => 'completed'])
            ->assertOk()
            ->assertJsonPath('updated', 2);

        $this->assertDatabaseHas('events', ['id' => $a->id, 'status' => 'completed']);
        $this->assertDatabaseHas('events', ['id' => $b->id, 'status' => 'completed']);
    }

    public function test_bulk_endpoints_require_an_admin_and_validate_input(): void
    {
        $event = $this->events()->create();

        $this->postJson('/api/events/bulk-delete', ['ids' => [$event->id]])->assertUnauthorized();

        $this->actingAsRole('coach');
        $this->postJson('/api/events/bulk-delete', ['ids' => [$event->id]])->assertForbidden();

        $this->actingAsRole('admin');
        $this->postJson('/api/events/bulk-delete', ['ids' => []])->assertStatus(422);
        $this->postJson('/api/events/bulk-status', ['ids' => [$event->id], 'status' => 'nope'])->assertStatus(422);
    }
}
