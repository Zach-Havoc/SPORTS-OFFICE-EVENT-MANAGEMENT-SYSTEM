<?php

namespace Tests\Feature;

use App\Events\LiveScoreUpdated;
use App\Events\ScoreboardUpdated;
use App\Models\Athlete;
use App\Models\Department;
use App\Models\Event;
use App\Models\GameEvent;
use App\Models\GamePlayer;
use App\Models\LiveScore;
use App\Models\TeamMatch;
use App\Services\BasketballScoreboard;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event as EventBus;
use Tests\TestCase;

/**
 * Play-by-play basketball scoring:
 *   GET    /api/events/{id}/scoreboard            (public)
 *   GET    /api/events/{id}/roster                (scorekeeper)
 *   PUT    /api/events/{id}/roster                (scorekeeper)
 *   POST   /api/events/{id}/plays                 (scorekeeper)
 *   DELETE /api/events/{id}/plays/last            (scorekeeper)
 *   PATCH  /api/events/{id}/plays/{play}/player   (scorekeeper)
 *   PUT    /api/events/{id}/period                (scorekeeper)
 *   POST   /api/events/{id}/finish                (scorekeeper)
 *
 * The score is computed from the plays and mirrored into live_scores.
 */
class BasketballScoringTest extends TestCase
{
    use RefreshDatabase;

    private Department $home;

    private Department $away;

    private Event $game;

    protected function setUp(): void
    {
        parent::setUp();

        $this->home = $this->departments()->create(['name' => 'College of Hoops Home', 'abbreviation' => 'CHH']);
        $this->away = $this->departments()->create(['name' => 'College of Hoops Away', 'abbreviation' => 'CHA']);
        $this->game = $this->events()->create([
            'category' => 'Basketball',
            'departments' => [$this->home->name, $this->away->name],
        ]);
    }

    /** Put an athlete on a game's roster and return them. */
    private function rostered(Department $team, string $jersey, ?Event $game = null): Athlete
    {
        $athlete = $this->athletes()->create(['department' => $team->name]);
        GamePlayer::create([
            'game_id' => ($game ?? $this->game)->id,
            'team_id' => $team->id,
            'player_id' => $athlete->id,
            'jersey_number' => $jersey,
        ]);

        return $athlete;
    }

    private function play(string $type, Department $team, ?Athlete $player = null)
    {
        return $this->postJson("/api/events/{$this->game->id}/plays", [
            'teamId' => $team->id,
            'type' => $type,
            'playerId' => $player?->id,
        ]);
    }

    private function team(array $scoreboard, Department $team): array
    {
        return collect($scoreboard['teams'])->firstWhere('id', $team->id);
    }

    public function test_score_is_computed_from_plays_and_synced_to_the_live_score(): void
    {
        $this->actingAsJudgeFor($this->game);
        $santos = $this->rostered($this->home, '7');

        $this->play('FG2', $this->home, $santos)->assertCreated();
        $this->play('FG3', $this->home, $santos)->assertCreated();
        $this->play('FT', $this->home)->assertCreated();
        $this->play('FOUL', $this->home, $santos)->assertCreated();
        $board = $this->play('FG2', $this->away)->assertCreated()->json();

        $home = $this->team($board, $this->home);
        $this->assertSame(6, $home['score']);
        $this->assertSame(2, $this->team($board, $this->away)['score']);
        $this->assertSame(1, $home['unassignedPoints']);
        $this->assertSame(6, $home['periodScores'][0]['points']);

        $row = collect($home['players'])->firstWhere('playerId', $santos->id);
        $this->assertSame(['pts' => 5, 'fg2' => 1, 'fg3' => 1, 'ft' => 0, 'pf' => 1, 'fouledOut' => false],
            array_intersect_key($row, array_flip(['pts', 'fg2', 'fg3', 'ft', 'pf', 'fouledOut'])));

        $live = LiveScore::where('event_id', $this->game->id)->firstOrFail();
        $this->assertSame(6, $live->home_score);
        $this->assertSame(2, $live->away_score);
        $this->assertSame('Q1', $live->period);
        $this->assertSame('in_progress', $live->status);
        $this->assertSame('ongoing', $this->game->fresh()->status);

        // The public scoreboard returns the same state.
        $this->getJson("/api/events/{$this->game->id}/scoreboard")
            ->assertOk()
            ->assertJsonPath('status', 'live')
            ->assertJsonPath('teams.0.score', 6)
            ->assertJsonCount(5, 'recentPlays');
    }

    public function test_undo_removes_the_latest_play_but_keeps_it_for_the_audit_trail(): void
    {
        $this->actingAsJudgeFor($this->game);
        $this->play('FG2', $this->home);
        $this->play('FG3', $this->away);

        $this->deleteJson("/api/events/{$this->game->id}/plays/last")
            ->assertOk()
            ->assertJsonPath('teams.0.score', 2)
            ->assertJsonPath('teams.1.score', 0);

        $undone = GameEvent::withTrashed()->where('type', 'FG3')->firstOrFail();
        $this->assertSoftDeleted($undone);
        $this->assertSame(0, LiveScore::where('event_id', $this->game->id)->value('away_score'));
    }

    public function test_undo_with_no_plays_is_rejected(): void
    {
        $this->actingAsJudgeFor($this->game);

        $this->deleteJson("/api/events/{$this->game->id}/plays/last")
            ->assertStatus(422)
            ->assertJsonPath('error', "There's nothing to undo yet.");
    }

    public function test_a_player_must_be_on_that_teams_roster_for_the_game(): void
    {
        $this->actingAsJudgeFor($this->game);
        $awayPlayer = $this->rostered($this->away, '4');

        $this->play('FG2', $this->home, $awayPlayer)
            ->assertStatus(422)
            ->assertJsonPath('error', "That player isn't on this team's roster for this game.");

        $this->assertSame(0, GameEvent::count());
    }

    public function test_a_player_rostered_in_another_game_is_rejected(): void
    {
        $this->actingAsJudgeFor($this->game);
        $otherGame = $this->events()->create(['departments' => [$this->home->name, $this->away->name]]);
        $elsewhere = $this->rostered($this->home, '9', $otherGame);

        $this->play('FG3', $this->home, $elsewhere)->assertStatus(422);
    }

    public function test_a_play_for_a_team_not_in_the_game_is_rejected(): void
    {
        $this->actingAsJudgeFor($this->game);
        $stranger = $this->departments()->create();

        $this->play('FG2', $stranger)->assertStatus(422)
            ->assertJsonPath('error', "That team isn't playing in this game.");
    }

    public function test_a_foul_needs_a_player_but_a_basket_does_not(): void
    {
        $this->actingAsJudgeFor($this->game);

        $this->play('FOUL', $this->home)
            ->assertStatus(422)
            ->assertJsonValidationErrors('playerId');

        $this->play('FG2', $this->home)->assertCreated();
    }

    public function test_a_fouled_out_player_cannot_be_given_any_more_plays(): void
    {
        $this->actingAsJudgeFor($this->game);
        $santos = $this->rostered($this->home, '7');

        for ($i = 0; $i < 5; $i++) {
            $board = $this->play('FOUL', $this->home, $santos)->assertCreated()->json();
        }
        $this->assertTrue(collect($this->team($board, $this->home)['players'])->firstWhere('playerId', $santos->id)['fouledOut']);

        $this->play('FG2', $this->home, $santos)
            ->assertStatus(422)
            ->assertJsonPath('error', "#7 {$santos->first_name} {$santos->last_name} has fouled out (5 fouls).");
        $this->play('FOUL', $this->home, $santos)->assertStatus(422);
    }

    public function test_a_basket_from_before_the_foul_out_can_still_be_credited_to_that_player(): void
    {
        $this->actingAsJudgeFor($this->game);
        $santos = $this->rostered($this->home, '7');

        $this->play('FG3', $this->home);
        $early = GameEvent::latest('id')->first();
        for ($i = 0; $i < 5; $i++) {
            $this->play('FOUL', $this->home, $santos);
        }

        $this->patchJson("/api/events/{$this->game->id}/plays/{$early->id}/player", ['playerId' => $santos->id])
            ->assertOk();
        $this->assertSame($santos->id, $early->fresh()->player_id);
    }

    public function test_an_unassigned_play_can_be_given_a_player_later(): void
    {
        $this->actingAsJudgeFor($this->game);
        $santos = $this->rostered($this->home, '7');
        $board = $this->play('FG3', $this->home)->json();
        $playId = $board['unassignedPlays'][0]['id'];

        $board = $this->patchJson("/api/events/{$this->game->id}/plays/{$playId}/player", ['playerId' => $santos->id])
            ->assertOk()->json();

        $home = $this->team($board, $this->home);
        $this->assertSame(0, $home['unassignedPoints']);
        $this->assertSame(3, collect($home['players'])->firstWhere('playerId', $santos->id)['pts']);
        $this->assertSame([], $board['unassignedPlays']);

        // Same roster validation as recording a play.
        $awayPlayer = $this->rostered($this->away, '4');
        $this->patchJson("/api/events/{$this->game->id}/plays/{$playId}/player", ['playerId' => $awayPlayer->id])
            ->assertStatus(422);
    }

    public function test_bonus_is_counted_per_period(): void
    {
        $this->actingAsJudgeFor($this->game);
        $a = $this->rostered($this->home, '7');
        $b = $this->rostered($this->home, '8');

        // FIBA: from the 5th team foul the opponent shoots, so after 4 the
        // team is in the bonus.
        foreach ([$a, $a, $b] as $p) {
            $board = $this->play('FOUL', $this->home, $p)->json();
        }
        $this->assertSame(3, $this->team($board, $this->home)['teamFouls']);
        $this->assertFalse($this->team($board, $this->home)['inBonus']);

        $board = $this->play('FOUL', $this->home, $b)->json();
        $this->assertSame(4, $this->team($board, $this->home)['teamFouls']);
        $this->assertTrue($this->team($board, $this->home)['inBonus']);
        $this->assertFalse($this->team($board, $this->away)['inBonus']);

        $board = $this->putJson("/api/events/{$this->game->id}/period", ['period' => 2])->assertOk()->json();
        $this->assertSame('Q2', $board['periodLabel']);
        $this->assertSame(0, $this->team($board, $this->home)['teamFouls']);
        $this->assertFalse($this->team($board, $this->home)['inBonus']);

        // Personal fouls are for the whole game.
        $this->assertSame(2, collect($this->team($board, $this->home)['players'])->firstWhere('playerId', $a->id)['pf']);
    }

    public function test_plays_are_stamped_with_the_servers_period(): void
    {
        $this->actingAsJudgeFor($this->game);
        $this->putJson("/api/events/{$this->game->id}/period", ['period' => 2])->assertOk();
        $this->play('FG2', $this->home);

        $this->assertSame(2, GameEvent::firstOrFail()->period);
    }

    public function test_periods_past_regulation_are_labelled_as_overtime(): void
    {
        $this->assertSame('Q4', BasketballScoreboard::periodLabel(4));
        $this->assertSame('OT1', BasketballScoreboard::periodLabel(5));
        $this->assertSame('OT2', BasketballScoreboard::periodLabel(6));

        $this->actingAsJudgeFor($this->game);
        foreach ([2, 3, 4] as $p) {
            $this->putJson("/api/events/{$this->game->id}/period", ['period' => $p])->assertOk();
        }

        // Tied 0–0 at the end of Q4 → OT1.
        $board = $this->putJson("/api/events/{$this->game->id}/period", ['period' => 5])->assertOk()->json();
        $this->assertSame('OT1', $board['periodLabel']);
        $this->assertSame('OT1', LiveScore::where('event_id', $this->game->id)->value('period'));
        $this->assertSame('OT1', end($board['teams'][0]['periodScores'])['label']);

        // Not tied → no second overtime.
        $this->play('FG2', $this->home);
        $this->putJson("/api/events/{$this->game->id}/period", ['period' => 6])
            ->assertStatus(422)
            ->assertJsonPath('error', "Overtime only follows a tie — it's 2–0. Finish the game instead.");
    }

    public function test_the_period_cannot_skip_ahead_or_go_behind_recorded_plays(): void
    {
        $this->actingAsJudgeFor($this->game);
        $this->putJson("/api/events/{$this->game->id}/period", ['period' => 3])->assertStatus(422);

        $this->putJson("/api/events/{$this->game->id}/period", ['period' => 2])->assertOk();
        $this->play('FG2', $this->home);
        $this->putJson("/api/events/{$this->game->id}/period", ['period' => 1])->assertStatus(422);
    }

    public function test_a_tied_game_cannot_be_finished(): void
    {
        $this->actingAsJudgeFor($this->game);
        $this->play('FG2', $this->home);
        $this->play('FG2', $this->away);

        $this->postJson("/api/events/{$this->game->id}/finish")
            ->assertStatus(422)
            ->assertJsonPath('error', 'The score is tied 2–2. Start Q2 instead of finishing.');

        $this->assertNotSame('final', LiveScore::where('event_id', $this->game->id)->value('status'));
    }

    public function test_finishing_records_the_winner_and_locks_the_game(): void
    {
        $this->actingAsJudgeFor($this->game);
        $this->play('FG3', $this->home);
        $this->play('FG2', $this->away);

        $this->postJson("/api/events/{$this->game->id}/finish")
            ->assertOk()
            ->assertJsonPath('status', 'finished')
            ->assertJsonPath('winnerTeamId', $this->home->id);

        $this->assertSame('completed', $this->game->fresh()->status);
        $this->assertSame('final', LiveScore::where('event_id', $this->game->id)->value('status'));
        $match = TeamMatch::where('event_id', $this->game->id)->firstOrFail();
        $this->assertSame($this->home->name, $match->winner);
        $this->assertSame('completed', $match->status);

        $this->play('FG2', $this->away)->assertStatus(422)
            ->assertJsonPath('error', 'This game is finished — no more plays can be recorded.');
        $this->deleteJson("/api/events/{$this->game->id}/plays/last")->assertStatus(422);
        $this->putJson("/api/events/{$this->game->id}/period", ['period' => 2])->assertStatus(422);
        $this->postJson("/api/events/{$this->game->id}/finish")->assertStatus(422);
    }

    public function test_only_the_assigned_committee_or_an_admin_can_write(): void
    {
        $id = $this->game->id;
        $body = ['teamId' => $this->home->id, 'type' => 'FG2'];

        // Guests can read, never write.
        $this->getJson("/api/events/{$id}/scoreboard")->assertOk();
        $this->postJson("/api/events/{$id}/plays", $body)->assertUnauthorized();

        foreach (['coach', 'athlete'] as $role) {
            $this->actingAsRole($role);
            $this->postJson("/api/events/{$id}/plays", $body)->assertForbidden();
            $this->deleteJson("/api/events/{$id}/plays/last")->assertForbidden();
            $this->postJson("/api/events/{$id}/finish")->assertForbidden();
        }

        // A committee member not assigned to this game.
        $this->actingAsRole('judge');
        $this->postJson("/api/events/{$id}/plays", $body)
            ->assertForbidden()
            ->assertJsonPath('error', 'You are not assigned to score this game.');
        $this->getJson("/api/events/{$id}/roster")->assertForbidden();

        $this->assertSame(0, GameEvent::count());

        $this->actingAsRole('admin');
        $this->postJson("/api/events/{$id}/plays", $body)->assertCreated();
    }

    public function test_every_write_broadcasts_the_full_scoreboard(): void
    {
        EventBus::fake([ScoreboardUpdated::class, LiveScoreUpdated::class]);
        $this->actingAsJudgeFor($this->game);

        $this->play('FG3', $this->home)->assertCreated();

        EventBus::assertDispatched(ScoreboardUpdated::class, function (ScoreboardUpdated $e) {
            return $e->scoreboard['eventId'] === $this->game->id
                && $e->scoreboard['teams'][0]['score'] === 3
                && $e->broadcastOn()[0]->name === 'live-scores.'.$this->game->id
                && $e->broadcastAs() === 'scoreboard';
        });
        EventBus::assertDispatched(LiveScoreUpdated::class, fn ($e) => $e->live['homeScore'] === 3);

        $this->deleteJson("/api/events/{$this->game->id}/plays/last");
        $this->putJson("/api/events/{$this->game->id}/period", ['period' => 2]);
        EventBus::assertDispatchedTimes(ScoreboardUpdated::class, 3);
    }

    public function test_a_rejected_play_broadcasts_nothing(): void
    {
        EventBus::fake([ScoreboardUpdated::class]);
        $this->actingAsJudgeFor($this->game);

        $this->deleteJson("/api/events/{$this->game->id}/plays/last")->assertStatus(422);

        EventBus::assertNotDispatched(ScoreboardUpdated::class);
    }

    public function test_the_manual_live_score_cannot_override_a_play_by_play_game(): void
    {
        $this->actingAsJudgeFor($this->game);
        $this->play('FG2', $this->home);

        $this->putJson("/api/events/{$this->game->id}/live", ['homeScore' => 40, 'awayScore' => 0])
            ->assertStatus(409);
        $this->putJson("/api/events/{$this->game->id}/live", ['status' => 'final'])->assertStatus(409);

        // Unrelated fields (e.g. the scoresheet photo) still go through.
        $this->putJson("/api/events/{$this->game->id}/live", ['detail' => ['sheetImageUrl' => 'x.jpg']])->assertOk();
        $this->assertSame(2, LiveScore::where('event_id', $this->game->id)->value('home_score'));
    }

    public function test_the_roster_is_set_per_team_with_unique_jerseys(): void
    {
        $this->actingAsJudgeFor($this->game);
        $a = $this->athletes()->create(['department' => $this->home->name, 'sport' => 'Basketball']);
        $b = $this->athletes()->create(['department' => 'CHH', 'sport' => 'Basketball']); // by abbreviation
        $outsider = $this->athletes()->create(['department' => $this->away->name]);

        $this->getJson("/api/events/{$this->game->id}/roster")
            ->assertOk()
            ->assertJsonCount(2, 'teams.0.candidates');

        $url = "/api/events/{$this->game->id}/roster";
        $this->putJson($url, ['teamId' => $this->home->id, 'players' => [
            ['playerId' => $a->id, 'jerseyNumber' => '7', 'isStarter' => true],
            ['playerId' => $b->id, 'jerseyNumber' => '7'],
        ]])->assertStatus(422);

        $this->putJson($url, ['teamId' => $this->home->id, 'players' => [
            ['playerId' => $outsider->id, 'jerseyNumber' => '1'],
        ]])->assertStatus(422)->assertJsonPath('error', "That athlete isn't from {$this->home->name}.");

        $board = $this->putJson($url, ['teamId' => $this->home->id, 'players' => [
            ['playerId' => $a->id, 'jerseyNumber' => '7', 'isStarter' => true],
            ['playerId' => $b->id, 'jerseyNumber' => '00'],
        ]])->assertOk()->json();
        $this->assertSame(['00', '7'], array_column($this->team($board, $this->home)['players'], 'jersey'));

        // A player with plays can't be dropped.
        $this->play('FG2', $this->home, $a)->assertCreated();
        $this->putJson($url, ['teamId' => $this->home->id, 'players' => [
            ['playerId' => $b->id, 'jerseyNumber' => '00'],
        ]])->assertStatus(422);
    }

    public function test_the_scoreboard_avoids_per_play_queries(): void
    {
        $this->actingAsJudgeFor($this->game);
        $players = collect(range(1, 8))->map(fn ($n) => $this->rostered($n % 2 ? $this->home : $this->away, (string) $n));
        foreach ($players as $p) {
            GameEvent::create(['game_id' => $this->game->id, 'team_id' => GamePlayer::where('player_id', $p->id)->value('team_id'),
                'player_id' => $p->id, 'type' => 'FG2', 'period' => 1]);
        }

        \DB::enableQueryLog();
        app(BasketballScoreboard::class)->build($this->game->fresh());
        $this->assertLessThanOrEqual(6, count(\DB::getQueryLog()));
    }
}
