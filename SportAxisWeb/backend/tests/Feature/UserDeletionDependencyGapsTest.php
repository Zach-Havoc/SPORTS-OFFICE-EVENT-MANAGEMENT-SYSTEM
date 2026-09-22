<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * UserController::destroy() only guards against two kinds of dependents
 * (rostered athletes, submitted scores — see coachDependents() and the
 * Score::judge_id check) before deleting a `users` row. It does not check
 * attendance_sessions or announcements, even though the schema wires both up
 * with `ON DELETE CASCADE` back to users.id:
 *
 *   attendance_sessions.coach_id   -> users.id  ON DELETE CASCADE
 *   attendance_records.session_id -> attendance_sessions.id ON DELETE CASCADE
 *   announcements.coach_id        -> users.id  ON DELETE CASCADE
 *
 * A coach with zero rostered athletes and no scores passes every existing
 * guard and IS deleted — silently hard-deleting their entire attendance
 * history and every announcement they posted via cascade. Neither
 * attendance_sessions/attendance_records nor (for the CASCADE path
 * specifically) the announcement row goes through Eloquent's soft-delete
 * machinery: a database-level CASCADE is a raw DELETE, not an
 * Eloquent ->delete() call, so it is unrecoverable even though the app's own
 * trash/restore flow (TrashController, Announcement::restore) treats
 * announcement deletion as always recoverable.
 *
 * These tests encode the behaviour the app's own guard pattern (see the
 * neighbouring "cannot be deleted" tests in UserManagementTest) implies is
 * intended — a coach with dependent records other than athletes/scores
 * should also be blocked from deletion — and currently FAIL because
 * UserController::destroy() has no such guard.
 */
class UserDeletionDependencyGapsTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_coach_with_attendance_history_cannot_be_deleted(): void
    {
        $this->actingAsRole('admin');

        $coach = $this->users()->coach()->create();
        // Deliberately not rostered under this coach, so coachDependents()
        // sees zero athletes and the existing guard passes clean — only the
        // attendance history is left to protect.
        $athlete = $this->athletes()->create();
        $session = $this->attendanceSessions()->create(['coach_id' => $coach->id, 'created_by' => $coach->id]);
        $record = $this->attendance()->create(['session_id' => $session->id, 'athlete_id' => $athlete->id]);

        $this->deleteJson("/api/admin/users/{$coach->id}")
            ->assertStatus(422)
            ->assertJsonValidationErrors('user');

        $this->assertDatabaseHas('users', ['id' => $coach->id]);
        $this->assertDatabaseHas('attendance_sessions', ['id' => $session->id]);
        $this->assertDatabaseHas('attendance_records', ['id' => $record->id]);
    }

    public function test_a_coach_with_announcements_cannot_be_deleted(): void
    {
        $this->actingAsRole('admin');

        $coach = $this->users()->coach()->create();
        $announcement = $this->announcements()->create(['coach_id' => $coach->id]);

        $this->deleteJson("/api/admin/users/{$coach->id}")
            ->assertStatus(422)
            ->assertJsonValidationErrors('user');

        $this->assertDatabaseHas('users', ['id' => $coach->id]);
        $this->assertDatabaseHas('announcements', ['id' => $announcement->id]);
    }
}
