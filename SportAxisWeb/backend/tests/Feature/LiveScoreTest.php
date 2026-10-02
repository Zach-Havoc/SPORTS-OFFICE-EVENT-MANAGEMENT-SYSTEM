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
        $event = $this->events()->create([
            'status' => 'upcoming',
            'departments' => ['College of Engineering', 'College of Business'],
        ]);
        $this->actingAsJudgeFor($event);

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
        $event = $this->events()->ongoing()->create([
            'category' => 'Basketball',
            'departments' => ['Team A', 'Team B'],
        ]);
        $this->actingAsJudgeFor($event);

        $this->putJson("/api/events/{$event->id}/live", [
            'homeScore' => 77, 'awayScore' => 64, 'status' => 'final',
        ])->assertOk()->assertJsonPath('live.status', 'final');

        $this->assertSame('completed', $event->fresh()->status);

        $match = TeamMatch::where('event_id', $event->id)->first();
        $this->assertNotNull($match);
        $this->assertSame('Team A', $match->winner);
        $this->assertEquals(77, $match->home_score);
    }

    public function test_a_game_scored_on_paper_is_in_progress_then_records_its_sheet_final(): void
    {
        $event = $this->events()->create([
            'status' => 'upcoming',
            'category' => 'Volleyball',
            'departments' => ['Team A', 'Team B'],
        ]);
        $this->actingAsJudgeFor($event);

        // Start · score on paper: the game is under way, with no running score.
        $this->putJson("/api/events/{$event->id}/live", ['status' => 'in_progress', 'method' => 'paper'])
            ->assertOk()
            ->assertJsonPath('live.status', 'in_progress')
            ->assertJsonPath('live.method', 'paper');
        $this->assertSame('ongoing', $event->fresh()->status);
        $this->getJson('/api/live-scores')->assertJsonFragment(['eventId' => $event->id, 'method' => 'paper']);

        // The scanned sheet records the final; the method is kept.
        $this->putJson("/api/events/{$event->id}/live", ['homeScore' => 3, 'awayScore' => 1, 'status' => 'final', 'version' => 1])
            ->assertOk()
            ->assertJsonPath('live.method', 'paper');
        $this->assertSame('completed', $event->fresh()->status);
        $this->assertSame('Team A', TeamMatch::where('event_id', $event->id)->value('winner'));
    }

    public function test_a_game_started_without_a_method_is_scored_live(): void
    {
        $event = $this->events()->create(['departments' => ['Team A', 'Team B']]);
        $this->actingAsJudgeFor($event);

        $this->putJson("/api/events/{$event->id}/live", ['homeScore' => 1])
            ->assertOk()->assertJsonPath('live.method', 'live');
        $this->putJson("/api/events/{$event->id}/live", ['method' => 'scoreboard', 'version' => 1])
            ->assertUnprocessable();
    }

    public function test_a_stale_write_is_rejected_with_409(): void
    {
        $event = $this->events()->create();
        $this->actingAsJudgeFor($event);
        LiveScore::create([
            'id' => 'ls-1', 'event_id' => $event->id, 'sport' => 'Basketball',
            'home_score' => 20, 'away_score' => 18, 'status' => 'in_progress', 'version' => 5,
        ]);

        $this->putJson("/api/events/{$event->id}/live", ['homeScore' => 99, 'version' => 3])
            ->assertStatus(409)
            ->assertJsonPath('live.version', 5)
            ->assertJsonPath('live.homeScore', 20);
    }

    public function test_a_committee_member_not_assigned_to_the_game_cannot_push_a_live_score(): void
    {
        $assigned = $this->users()->judge()->create();
        $event = $this->events()->judgedBy($assigned)->create();

        $this->actingAsRole('judge');
        $this->putJson("/api/events/{$event->id}/live", ['homeScore' => 1])->assertForbidden();
        $this->assertDatabaseCount('live_scores', 0);

        $this->loginAs($assigned);
        $this->putJson("/api/events/{$event->id}/live", ['homeScore' => 1])->assertOk();
    }

    public function test_the_office_can_push_a_live_score_without_being_assigned(): void
    {
        $event = $this->events()->create();

        $this->actingAsRole('admin');
        $this->putJson("/api/events/{$event->id}/live", ['homeScore' => 3])->assertOk();
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

    public function test_live_score_polling_has_its_own_rate_limit_budget(): void
    {
        // Viewers poll the live board every few seconds when there's no
        // realtime socket; a campus can share one IP. That polling mustn't
        // eat the general API budget, and vice versa.
        config(['security.api_per_minute' => 3, 'security.live_per_minute' => 50]);
        $event = $this->events()->create();

        for ($i = 0; $i < 6; $i++) {
            $this->getJson('/api/live-scores')->assertOk();
            $this->getJson("/api/events/{$event->id}/live")->assertOk();
        }

        $statuses = collect(range(1, 5))->map(fn () => $this->getJson('/api/departments')->status());
        $this->assertContains(429, $statuses->all());
    }
}
