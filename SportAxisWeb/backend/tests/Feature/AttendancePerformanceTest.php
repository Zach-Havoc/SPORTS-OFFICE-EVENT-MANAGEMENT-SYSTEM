<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Attendance + performance recording (coach).
 *
 * Security focus: a coach may only record against athletes on their OWN
 * roster. Off-roster ids are silently skipped (attendance) or rejected
 * (performance).
 */
class AttendancePerformanceTest extends TestCase
{
    use RefreshDatabase;

    // ── Attendance ──────────────────────────────────────────────────────

    public function test_marking_attendance_requires_a_coach(): void
    {
        $this->postJson('/api/attendance', ['records' => []])->assertUnauthorized();

        $this->actingAsRole('athlete');
        $this->postJson('/api/attendance', ['records' => []])->assertForbidden();
    }

    public function test_coach_can_mark_attendance_for_their_roster(): void
    {
        $coach   = $this->actingAsRole('coach');
        $athlete = $this->athletes()->create(['coach_id' => $coach->id]);

        $this->postJson('/api/attendance', [
            'records' => [[
                'athleteId' => $athlete->id,
                'date'      => now()->toDateString(),
                'status'    => 'present',
            ]],
        ])->assertCreated();

        $this->assertDatabaseHas('attendance_records', [
            'athlete_id'  => $athlete->id,
            'status'      => 'present',
            'recorded_by' => $coach->id,
        ]);
    }

    public function test_attendance_for_an_off_roster_athlete_is_skipped(): void
    {
        $coach       = $this->actingAsRole('coach');
        $mine        = $this->athletes()->create(['coach_id' => $coach->id]);
        $otherCoach  = $this->users()->coach()->create();
        $notMine     = $this->athletes()->create(['coach_id' => $otherCoach->id]);

        $this->postJson('/api/attendance', [
            'records' => [
                ['athleteId' => $mine->id,    'date' => now()->toDateString(), 'status' => 'present'],
                ['athleteId' => $notMine->id, 'date' => now()->toDateString(), 'status' => 'present'],
            ],
        ])->assertCreated();

        $this->assertDatabaseHas('attendance_records', ['athlete_id' => $mine->id]);
        $this->assertDatabaseMissing('attendance_records', ['athlete_id' => $notMine->id]);
    }

    public function test_attendance_status_must_be_a_valid_value(): void
    {
        $coach   = $this->actingAsRole('coach');
        $athlete = $this->athletes()->create(['coach_id' => $coach->id]);

        $this->postJson('/api/attendance', [
            'records' => [['athleteId' => $athlete->id, 'date' => now()->toDateString(), 'status' => 'teleported']],
        ])->assertStatus(422)->assertJsonValidationErrors('records.0.status');
    }

    public function test_attendance_index_is_scoped_to_the_coachs_athletes(): void
    {
        $coach      = $this->actingAsRole('coach');
        $mine       = $this->athletes()->create(['coach_id' => $coach->id]);
        $otherCoach = $this->users()->coach()->create();
        $notMine    = $this->athletes()->create(['coach_id' => $otherCoach->id]);

        $this->attendance()->create(['athlete_id' => $mine->id, 'notes' => 'keep']);
        $this->attendance()->create(['athlete_id' => $notMine->id, 'notes' => 'hide']);

        $this->getJson('/api/attendance')
            ->assertOk()
            ->assertJsonFragment(['notes' => 'keep'])
            ->assertJsonMissing(['notes' => 'hide']);
    }

    // ── Performance ─────────────────────────────────────────────────────

    public function test_recording_performance_requires_a_coach(): void
    {
        $this->postJson('/api/performance', [])->assertUnauthorized();

        $this->actingAsRole('athlete');
        $this->postJson('/api/performance', [])->assertForbidden();
    }

    public function test_coach_can_record_performance_for_a_roster_athlete(): void
    {
        $coach   = $this->actingAsRole('coach');
        $athlete = $this->athletes()->create(['coach_id' => $coach->id]);

        $this->postJson('/api/performance', [
            'athleteId'     => $athlete->id,
            'athleteName'   => 'Sam Cruz',
            'overallRating' => 8,
        ])->assertCreated();

        $this->assertDatabaseHas('performance_records', [
            'athlete_id'  => $athlete->id,
            'recorded_by' => $coach->id,
        ]);
    }

    public function test_coach_cannot_record_performance_for_an_off_roster_athlete(): void
    {
        $this->actingAsRole('coach');
        $otherCoach = $this->users()->coach()->create();
        $notMine    = $this->athletes()->create(['coach_id' => $otherCoach->id]);

        $this->postJson('/api/performance', [
            'athleteId'   => $notMine->id,
            'athleteName' => 'Not Mine',
        ])->assertForbidden()
          ->assertJsonFragment(['error' => 'Athlete is not on your roster']);

        $this->assertDatabaseCount('performance_records', 0);
    }

    public function test_overall_rating_must_be_between_1_and_10(): void
    {
        $coach   = $this->actingAsRole('coach');
        $athlete = $this->athletes()->create(['coach_id' => $coach->id]);

        $this->postJson('/api/performance', [
            'athleteId' => $athlete->id, 'athleteName' => 'X', 'overallRating' => 11,
        ])->assertStatus(422)->assertJsonValidationErrors('overallRating');
    }
}
