<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\LiveScore;
use App\Models\TeamMatch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Live game scores:
 *   GET    /api/live-scores            (public)
 *   GET    /api/events/{id}/live       (public)
 *   PUT    /api/events/{id}/live       (committee / admin)
 *   DELETE /api/events/{id}/live       (admin)
 *
 * Starting a live score flips the event to `ongoing`; finalising flips it to
 * `completed` and records the head-to-head in `team_matches`. `version` bumps
 * on every write and a stale write is rejected with 409.
 */
class LiveScoreTest extends TestCase
{
    use RefreshDatabase;

    public function test_live_scores_index_is_public_and_lists_in_progress_games(): void
    {
        $a = $this->events()->create();
        $b = $this->events()->create();
        $this->liveScores()->inProgress()->create(['event_id' => $a->id, 'home_score' => 12, 'away_score' => 9]);
        $this->liveScores()->create(['event_id' => $b->id, 'status' => 'scheduled']);

        $this->getJson('/api/live-scores')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonFragment(['eventId' => $a->id, 'homeScore' => 12, 'awayScore' => 9]);
    }

    public function test_show_returns_null_when_no_live_score_exists(): void
    {
        $event = $this->events()->create();

        $this->getJson("/api/events/{$event->id}/live")
            ->assertOk()
            ->assertJsonPath('live', null);
    }

    public function test_a_committee_member_starts_and_updates_a_live_score(): void
    {
        $this->actingAsRole('judge');
        $event = $this->events()->create([
            'status' => 'upcoming',
            'departments' => ['College of Engineering', 'College of Business'],
        ]);

        $first = $this->putJson("/api/events/{$event->id}/live", [
            'homeScore' => 4, 'awayScore' => 2, 'period' => 'Q1',
        ])->assertOk();

        $first->assertJsonPath('live.status', 'in_progress')
            ->assertJsonPath('live.homeScore', 4)
            ->assertJsonPath('live.version', 1)
            ->assertJsonPath('live.homeTeam', 'College of Engineering');

        // Event was flipped to ongoing by the first push.
        $this->assertSame('ongoing', $event->fresh()->status);

        $this->putJson("/api/events/{$event->id}/live", ['homeScore' => 10, 'version' => 1])
            ->assertOk()
            ->assertJsonPath('live.homeScore', 10)
            ->assertJsonPath('live.awayScore', 2) // carried over
            ->assertJsonPath('live.version', 2);
    }

    public function test_finalising_completes_the_event_and_records_the_head_to_head(): void
    {
        $this->actingAsRole('judge');
        $event = $this->events()->ongoing()->create([
            'category' => 'Basketball',
            'departments' => ['Team A', 'Team B'],
        ]);

        $this->putJson("/api/events/{$event->id}/live", [
            'homeScore' => 77, 'awayScore' => 64, 'status' => 'final',
        ])->assertOk()->assertJsonPath('live.status', 'final');

        $this->assertSame('completed', $event->fresh()->status);

        $match = TeamMatch::where('event_id', $event->id)->first();
        $this->assertNotNull($match);
        $this->assertSame('Team A', $match->winner);
        $this->assertEquals(77, $match->home_score);
    }

    public function test_a_stale_write_is_rejected_with_409(): void
    {
        $this->actingAsRole('judge');
        $event = $this->events()->create();
        LiveScore::create([
            'id' => 'ls-1', 'event_id' => $event->id, 'sport' => 'Basketball',
            'home_score' => 20, 'away_score' => 18, 'status' => 'in_progress', 'version' => 5,
        ]);

        $this->putJson("/api/events/{$event->id}/live", ['homeScore' => 99, 'version' => 3])
            ->assertStatus(409)
            ->assertJsonPath('live.version', 5)
            ->assertJsonPath('live.homeScore', 20);
    }

    public function test_coaches_and_athletes_cannot_push_a_live_score(): void
    {
        $event = $this->events()->create();

        $this->putJson("/api/events/{$event->id}/live", ['homeScore' => 1])->assertUnauthorized();

        $this->actingAsRole('coach');
        $this->putJson("/api/events/{$event->id}/live", ['homeScore' => 1])->assertForbidden();

        $this->actingAsRole('athlete');
        $this->putJson("/api/events/{$event->id}/live", ['homeScore' => 1])->assertForbidden();
    }

    public function test_admin_can_clear_a_live_score(): void
    {
        $admin = $this->actingAsRole('admin');
        $event = $this->events()->create();
        $this->liveScores()->create(['event_id' => $event->id]);

        $this->deleteJson("/api/events/{$event->id}/live")->assertOk();
        $this->assertDatabaseMissing('live_scores', ['event_id' => $event->id]);
    }
}
