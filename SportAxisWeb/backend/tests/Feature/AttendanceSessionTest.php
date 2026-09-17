<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Session-based attendance: a coach creates many sessions and marks a roster in
 * each. Records are unique per (session, athlete); everything is owner-scoped.
 */
class AttendanceSessionTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_coach_creates_and_lists_sessions(): void
    {
        $this->actingAsRole('coach');

        $this->postJson('/api/attendance/sessions', ['title' => 'Training session', 'date' => '2026-09-04'])
            ->assertCreated()
            ->assertJsonPath('title', 'Training session')
            ->assertJsonPath('markedCount', 0)
            ->assertJsonPath('complete', false);

        $this->getJson('/api/attendance/sessions')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.title', 'Training session');
    }

    public function test_sessions_are_scoped_to_their_coach(): void
    {
        $owner = $this->actingAsRole('coach');
        $session = $this->attendanceSessions()->create(['coach_id' => $owner->id]);

        $otherCoach = $this->users()->coach()->create();
        $this->attendanceSessions()->create(['coach_id' => $otherCoach->id]);

        $this->getJson('/api/attendance/sessions')->assertOk()->assertJsonCount(1);

        // A different coach can't touch it.
        $this->actingAsRole('coach');
        $this->getJson("/api/attendance/sessions/{$session->id}")->assertNotFound();
        $this->putJson("/api/attendance/sessions/{$session->id}", ['title' => 'Hijack'])->assertNotFound();
        $this->deleteJson("/api/attendance/sessions/{$session->id}")->assertNotFound();
        $this->postJson("/api/attendance/sessions/{$session->id}/records", ['records' => []])->assertNotFound();
    }

    public function test_marking_a_session_writes_and_updates_in_place(): void
    {
        $coach = $this->actingAsRole('coach');
        $session = $this->attendanceSessions()->create(['coach_id' => $coach->id]);
        $a = $this->athletes()->create(['coach_id' => $coach->id]);
        $b = $this->athletes()->create(['coach_id' => $coach->id]);

        $this->postJson("/api/attendance/sessions/{$session->id}/records", [
            'records' => [
                ['athleteId' => $a->id, 'status' => 'present'],
                ['athleteId' => $b->id, 'status' => 'absent', 'notes' => 'sick'],
            ],
        ])->assertOk()
            ->assertJsonPath('markedCount', 2)
            ->assertJsonPath('rosterCount', 2)
            ->assertJsonPath('saved', 2);

        // Re-mark A → same row, new status.
        $this->postJson("/api/attendance/sessions/{$session->id}/records", [
            'records' => [['athleteId' => $a->id, 'status' => 'late']],
        ])->assertOk();

        $this->assertDatabaseCount('attendance_records', 2);
        $this->assertDatabaseHas('attendance_records', ['session_id' => $session->id, 'athlete_id' => $a->id, 'status' => 'late']);
    }

    public function test_off_roster_athletes_are_skipped(): void
    {
        $coach = $this->actingAsRole('coach');
        $session = $this->attendanceSessions()->create(['coach_id' => $coach->id]);
        $mine = $this->athletes()->create(['coach_id' => $coach->id]);
        $other = $this->users()->coach()->create();
        $notMine = $this->athletes()->create(['coach_id' => $other->id]);

        $this->postJson("/api/attendance/sessions/{$session->id}/records", [
            'records' => [
                ['athleteId' => $mine->id, 'status' => 'present'],
                ['athleteId' => $notMine->id, 'status' => 'present'],
            ],
        ])->assertOk()->assertJsonPath('saved', 1)->assertJsonPath('skipped', 1);

        $this->assertDatabaseMissing('attendance_records', ['athlete_id' => $notMine->id]);
    }

    public function test_a_session_reports_complete_once_every_athlete_is_marked(): void
    {
        $coach = $this->actingAsRole('coach');
        $session = $this->attendanceSessions()->create(['coach_id' => $coach->id]);
        $a = $this->athletes()->create(['coach_id' => $coach->id]);
        $b = $this->athletes()->create(['coach_id' => $coach->id]);

        $this->postJson("/api/attendance/sessions/{$session->id}/records", [
            'records' => [['athleteId' => $a->id, 'status' => 'present']],
        ])->assertOk()->assertJsonPath('markedCount', 1);

        $this->getJson('/api/attendance/sessions')->assertOk()->assertJsonPath('0.complete', false);

        $this->postJson("/api/attendance/sessions/{$session->id}/records", [
            'records' => [['athleteId' => $b->id, 'status' => 'absent']],
        ])->assertOk();

        $this->getJson('/api/attendance/sessions')->assertOk()->assertJsonPath('0.complete', true);
    }

    public function test_updating_and_deleting_a_session(): void
    {
        $coach = $this->actingAsRole('coach');
        $session = $this->attendanceSessions()->create(['coach_id' => $coach->id]);
        $a = $this->athletes()->create(['coach_id' => $coach->id]);
        $this->postJson("/api/attendance/sessions/{$session->id}/records", [
            'records' => [['athleteId' => $a->id, 'status' => 'present']],
        ])->assertOk();

        $this->putJson("/api/attendance/sessions/{$session->id}", ['title' => 'Scrimmage', 'date' => '2026-09-10'])
            ->assertOk()->assertJsonPath('title', 'Scrimmage')->assertJsonPath('date', '2026-09-10');

        $this->deleteJson("/api/attendance/sessions/{$session->id}")->assertOk();
        $this->assertDatabaseCount('attendance_sessions', 0);
        $this->assertDatabaseCount('attendance_records', 0);
    }

    public function test_creating_a_session_requires_a_title_and_date(): void
    {
        $this->actingAsRole('coach');
        $this->postJson('/api/attendance/sessions', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['title', 'date']);
    }

    public function test_non_coaches_cannot_use_session_endpoints(): void
    {
        $this->getJson('/api/attendance/sessions')->assertUnauthorized();
        $this->actingAsRole('athlete');
        $this->getJson('/api/attendance/sessions')->assertForbidden();
    }
}
