<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\ScoreController;
use App\Models\AuditLog;
use App\Models\Event;
use App\Models\Ranking;
use App\Models\Score;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The data-integrity floor: an append-only audit trail on every meaningful
 * write, and recoverable (soft) deletes with restore endpoints and a trash
 * listing.
 */
class DataIntegrityTest extends TestCase
{
    use RefreshDatabase;

    // ── Audit trail ────────────────────────────────────────────────────────

    public function test_creating_a_record_writes_an_audit_row_naming_the_actor(): void
    {
        $admin = $this->actingAsRole('admin', ['name' => 'Sports Office']);

        $this->postJson('/api/events', [
            'name' => 'Opening Game',
            'category' => 'Basketball',
            'schedule' => now()->addWeek()->toDateString(),
            'startTime' => '09:00',
            'endTime' => '11:00',
            'departments' => ['College of Engineering', 'College of Business'],
        ])->assertCreated();

        $log = AuditLog::where('auditable_type', Event::class)->where('event', 'created')->first();

        $this->assertNotNull($log);
        $this->assertSame($admin->id, $log->user_id);
        $this->assertSame('Sports Office', $log->user_name);
        $this->assertSame('admin', $log->user_role);
        $this->assertSame('Opening Game', $log->new_values['name']);
        $this->assertNull($log->old_values);
        $this->assertStringContainsString('POST', $log->url);
    }

    public function test_updating_a_record_captures_only_the_changed_keys_with_before_and_after(): void
    {
        $this->actingAsRole('admin');
        $event = $this->events()->create(['name' => 'Original', 'status' => 'upcoming']);

        $this->putJson("/api/events/{$event->id}", ['status' => 'ongoing'])->assertOk();

        $log = AuditLog::where('auditable_id', $event->id)->where('event', 'updated')->latest('id')->first();

        $this->assertNotNull($log);
        $this->assertSame(['status' => 'upcoming'], $log->old_values);
        $this->assertSame('ongoing', $log->new_values['status']);
        $this->assertArrayNotHasKey('name', $log->new_values);
    }

    public function test_a_password_change_is_recorded_but_the_value_is_redacted(): void
    {
        $this->actingAsRole('admin');
        $coach = $this->users()->state(['role' => 'coach'])->create();

        $this->postJson("/api/admin/users/{$coach->id}/reset-password")->assertOk();

        $log = AuditLog::where('auditable_id', $coach->id)->where('event', 'updated')->latest('id')->first();

        $this->assertNotNull($log);
        $this->assertSame(['password'], $log->new_values['_redacted']);
        $this->assertArrayNotHasKey('password', $log->new_values);
        $this->assertArrayNotHasKey('password', $log->old_values ?? []);
    }

    public function test_soft_delete_and_restore_are_each_audited(): void
    {
        $this->actingAsRole('admin');
        $event = $this->events()->create();

        $this->deleteJson("/api/events/{$event->id}")->assertOk();
        $this->postJson("/api/events/{$event->id}/restore")->assertOk();

        $events = AuditLog::where('auditable_id', $event->id)->orderBy('id')->pluck('event')->all();

        $this->assertSame(['created', 'deleted', 'restored'], $events);
    }

    public function test_without_recording_suspends_the_trail(): void
    {
        $this->actingAsRole('admin');

        AuditLog::withoutRecording(fn () => $this->events()->create());

        $this->assertSame(0, AuditLog::where('auditable_type', Event::class)->count());
        $this->assertTrue(AuditLog::$recording, 'recording is restored afterwards');
    }

    // ── Soft deletes ──────────────────────────────────────────────────────

    public function test_a_soft_deleted_event_is_hidden_everywhere_but_recoverable(): void
    {
        $this->actingAsRole('admin');
        $event = $this->events()->create(['name' => 'Semifinal']);

        $this->deleteJson("/api/events/{$event->id}")->assertOk();

        $this->assertSoftDeleted('events', ['id' => $event->id]);
        $this->getJson('/api/events')->assertOk()->assertJsonMissing(['id' => $event->id]);
        $this->getJson("/api/events/{$event->id}")->assertNotFound();
        $this->assertSame(0, Event::count());

        $this->postJson("/api/events/{$event->id}/restore")->assertOk();
        $this->assertNotSoftDeleted('events', ['id' => $event->id]);
        $this->getJson('/api/events')->assertJsonFragment(['id' => $event->id]);
    }

    public function test_only_an_admin_reaches_the_trash_and_audit_endpoints(): void
    {
        foreach (['coach', 'athlete', 'judge'] as $role) {
            $this->actingAsRole($role);
            $this->getJson('/api/admin/trash')->assertForbidden();
            $this->getJson('/api/admin/audit-logs')->assertForbidden();
        }

        $this->actingAsRole('admin');
        $this->getJson('/api/admin/trash')->assertOk();
        $this->getJson('/api/admin/audit-logs')->assertOk();
    }

    public function test_the_trash_endpoint_lists_soft_deleted_rows_by_type(): void
    {
        $this->actingAsRole('admin');
        $event = $this->events()->create(['name' => 'Trashed Game']);
        $this->deleteJson("/api/events/{$event->id}")->assertOk();

        $this->getJson('/api/admin/trash')
            ->assertOk()
            ->assertJsonPath('events.0.id', $event->id)
            ->assertJsonPath('events.0.label', 'Trashed Game')
            ->assertJsonCount(0, 'brackets');
    }

    public function test_the_audit_log_endpoint_filters_to_one_record(): void
    {
        $this->actingAsRole('admin');
        $a = $this->events()->create();
        $b = $this->events()->create();
        $this->putJson("/api/events/{$a->id}", ['status' => 'ongoing'])->assertOk();

        $this->getJson("/api/admin/audit-logs?type=Event&id={$a->id}")
            ->assertOk()
            ->assertJsonPath('logs.0.auditableId', $a->id)
            ->assertJsonMissing(['auditableId' => $b->id]);
    }

    // ── Soft deletes and derived data ────────────────────────────────────

    public function test_removing_a_score_recomputes_rankings_and_restoring_reverses_it(): void
    {
        $this->actingAsRole('admin');
        $event = $this->events()->create();

        $engineering = $this->scores()->create([
            'event_id' => $event->id, 'department' => 'College of Engineering', 'total_score' => 90,
        ]);
        $business = $this->scores()->create([
            'event_id' => $event->id, 'department' => 'College of Business', 'total_score' => 70,
        ]);
        ScoreController::recalculateRankings($event->id);
        $this->assertSame(2, Ranking::where('event_id', $event->id)->count());

        $this->deleteJson("/api/scores/{$engineering->id}")->assertOk();
        $this->assertSoftDeleted('scores', ['id' => $engineering->id]);
        $this->assertSame(1, Ranking::where('event_id', $event->id)->count());
        $this->assertSame('College of Business', Ranking::where('event_id', $event->id)->value('department'));

        $this->postJson("/api/scores/{$engineering->id}/restore")->assertOk();
        $this->assertSame(2, Ranking::where('event_id', $event->id)->count());
        $this->assertSame('College of Engineering', Ranking::where('event_id', $event->id)->where('rank', 1)->value('department'));

        // The judge account is protected by a RESTRICT foreign key.
        $this->assertNotNull(Score::withTrashed()->find($business->id));
    }
}
