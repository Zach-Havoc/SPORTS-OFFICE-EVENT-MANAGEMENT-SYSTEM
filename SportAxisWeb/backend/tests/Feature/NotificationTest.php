<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\ScoreController;
use App\Models\Protest;
use App\Models\Requirement;
use App\Notifications\ProtestResolved;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_filing_a_protest_notifies_the_admins(): void
    {
        $admin = $this->users()->state(['role' => 'admin', 'active' => true])->create();
        $event = $this->events()->create();

        $this->actingAsRole('coach', ['department' => 'CICS']);
        $this->postJson('/api/protests', [
            'eventId' => $event->id,
            'reason' => 'The tally on the board did not match our signed score sheet.',
        ])->assertCreated();

        $this->assertSame(1, $admin->fresh()->notifications()->count());
        $this->assertSame('protest_filed', $admin->notifications()->first()->data['kind']);
    }

    public function test_resolving_a_protest_notifies_the_filing_coach(): void
    {
        $event = $this->events()->create();
        $coach = $this->actingAsRole('coach', ['department' => 'CET']);
        $filed = $this->postJson('/api/protests', [
            'eventId' => $event->id,
            'reason' => 'Requesting a review of the final margin in this game.',
        ])->json();

        $this->actingAsRole('admin');
        $this->postJson("/api/protests/{$filed['id']}/resolve", [
            'status' => 'dismissed',
            'resolution' => 'Checked the sheets; the recorded result stands.',
        ])->assertOk();

        $this->assertSame('protest_resolved', $coach->fresh()->notifications()->first()?->data['kind']);
    }

    public function test_reviewing_a_requirement_notifies_the_athlete(): void
    {
        $coach = $this->actingAsRole('coach');
        $athlete = $this->users()->state(['role' => 'athlete', 'coach_id' => $coach->id])->create();

        $req = Requirement::create([
            'id' => (string) Str::uuid(),
            'athlete_id' => $athlete->id,
            'athlete_name' => $athlete->name,
            'type' => 'medical',
            'name' => 'Medical clearance',
            'status' => 'pending',
            'submitted_at' => now(),
        ]);

        $this->putJson("/api/requirements/{$req->id}/status", ['status' => 'approved'])->assertOk();

        $this->assertSame('requirement_reviewed', $athlete->fresh()->notifications()->first()?->data['kind']);
    }

    public function test_disputing_a_score_notifies_the_admins(): void
    {
        $admin = $this->users()->state(['role' => 'admin', 'active' => true])->create();
        $event = $this->events()->create();
        $score = $this->scores()->create(['event_id' => $event->id, 'department' => 'CICS', 'total_score' => 88]);
        ScoreController::recalculateRankings($event->id);

        $this->actingAsRole('admin');
        $this->postJson("/api/scores/{$score->id}/dispute", ['reason' => 'Transcription error suspected.'])->assertOk();

        $this->assertTrue(
            $admin->fresh()->notifications()->get()->contains(fn ($n) => $n->data['kind'] === 'score_disputed')
        );
    }

    public function test_a_user_sees_only_their_own_notifications_and_can_mark_them_read(): void
    {
        $me = $this->actingAsRole('coach');
        $other = $this->users()->state(['role' => 'coach'])->create();

        $me->notify(new ProtestResolved(new Protest([
            'id' => 'p1', 'status' => 'upheld', 'event_id' => 'e1',
        ])));
        $other->notify(new ProtestResolved(new Protest([
            'id' => 'p2', 'status' => 'upheld', 'event_id' => 'e1',
        ])));

        $res = $this->getJson('/api/notifications')->assertOk();
        $res->assertJsonPath('unreadCount', 1)->assertJsonCount(1, 'items');

        $id = $res->json('items.0.id');
        $this->postJson("/api/notifications/{$id}/read")->assertOk();
        $this->getJson('/api/notifications?unread=1')->assertJsonPath('unreadCount', 0)->assertJsonCount(0, 'items');
    }
}
