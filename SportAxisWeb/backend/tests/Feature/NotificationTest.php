<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\ScoreController;
use App\Models\Protest;
use App\Models\Requirement;
use App\Notifications\ProtestResolved;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use RefreshDatabase;

    /** A game CICS and CET played this morning, inside the 12-hour protest window. */
    private function playedGame()
    {
        Storage::fake('public');
        $this->travelTo(Carbon::parse('2026-10-07 04:00:00', 'UTC'));

        return $this->events()->create([
            'departments' => ['CICS', 'CET'], 'schedule' => '2026-10-07',
            'start_time' => '09:00', 'end_time' => '11:00', 'status' => 'completed',
        ]);
    }

    private function fileProtest(string $eventId, string $reason)
    {
        return $this->post('/api/protests', [
            'eventId' => $eventId,
            'reason' => $reason,
            'form' => UploadedFile::fake()->create('protest.pdf', 80, 'application/pdf'),
        ], ['Accept' => 'application/json']);
    }

    public function test_filing_a_protest_notifies_the_admins(): void
    {
        $admin = $this->users()->state(['role' => 'admin', 'active' => true])->create();
        $event = $this->playedGame();

        $this->actingAsRole('coach', ['department' => 'CICS']);
        $this->fileProtest($event->id, 'The tally on the board did not match our signed score sheet.')->assertCreated();

        $this->assertSame(1, $admin->fresh()->notifications()->count());
        $this->assertSame('protest_filed', $admin->notifications()->first()->data['kind']);
    }

    public function test_resolving_a_protest_notifies_the_filing_coach(): void
    {
        $event = $this->playedGame();
        $coach = $this->actingAsRole('coach', ['department' => 'CET']);
        $filed = $this->fileProtest($event->id, 'Requesting a review of the final margin in this game.')->json();

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

        // The notice is queued, so the protests it names have to exist.
        $event = $this->events()->create();
        $mine = Protest::create(['id' => 'p1', 'status' => 'upheld', 'event_id' => $event->id,
            'filed_by' => $me->id, 'department' => 'CICS', 'reason' => str_repeat('r', 20)]);
        $theirs = Protest::create(['id' => 'p2', 'status' => 'upheld', 'event_id' => $event->id,
            'filed_by' => $other->id, 'department' => 'CET', 'reason' => str_repeat('r', 20)]);
        $me->notify(new ProtestResolved($mine));
        $other->notify(new ProtestResolved($theirs));

        $res = $this->getJson('/api/notifications')->assertOk();
        $res->assertJsonPath('unreadCount', 1)->assertJsonCount(1, 'items');

        $id = $res->json('items.0.id');
        $this->postJson("/api/notifications/{$id}/read")->assertOk();
        $this->getJson('/api/notifications?unread=1')->assertJsonPath('unreadCount', 0)->assertJsonCount(0, 'items');
    }
}
