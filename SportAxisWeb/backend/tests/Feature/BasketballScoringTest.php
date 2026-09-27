<?php

namespace Tests\Feature;

use App\Events\LiveScoreUpdated;
use App\Models\Athlete;
use App\Models\Department;
use App\Models\Event;
use App\Models\GameEvent;
use App\Models\GamePlayer;
use App\Models\LiveScore;
use App\Models\TeamMatch;
use App\Services\BasketballScoreboard;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event as EventBus;
use Tests\TestCase;

/**
 * Play-by-play basketball scoring (the mobile scorer):
 *   GET    /api/events/{id}/scoreboard        (public)
 *   POST   /api/events/{id}/roster/sync       (scorekeeper)
 *   POST   /api/events/{id}/plays             (scorekeeper)
 *   DELETE /api/events/{id}/plays/last        (scorekeeper)
 *   PUT    /api/events/{id}/period            (scorekeeper)
 *   POST   /api/events/{id}/finish            (scorekeeper)
 * plus the coach setting an athlete's jersey number (PUT /api/athletes/{id}).
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

    /** Put an athlete on a game's roster directly and return them. */
    private function rostered(Department $team, string $jersey, ?Event $game = null): Athlete
    {
        $athlete = $this->athletes()->create(['department' => $team->name, 'jersey_number' => $jersey]);
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

    private function sync()
    {
        return $this->postJson("/api/events/{$this->game->id}/roster/sync");
    }

    // ── Scoring ─────────────────────────────────────────────────────────

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
        $this->assertSame(1, $home['teamFouls']);

        $row = collect($home['players'])->firstWhere('playerId', $santos->id);
        $this->assertSame(['pts' => 5, 'fg2' => 1, 'fg3' => 1, 'ft' => 0, 'pf' => 1],
            array_intersect_key($row, array_flip(['pts', 'fg2', 'fg3', 'ft', 'pf'])));

        $live = LiveScore::where('event_id', $this->game->id)->firstOrFail();
        $this->assertSame(6, $live->home_score);
        $this->assertSame(2, $live->away_score);
        $this->assertSame('Q1', $live->period);
        $this->assertSame('in_progress', $live->status);
        $this->assertSame('ongoing', $this->game->fresh()->status);

        $this->getJson("/api/events/{$this->game->id}/scoreboard")
            ->assertOk()
            ->assertJsonPath('status', 'live')
            ->assertJsonPath('teams.0.score', 6)
            ->assertJsonPath('playCount', 5);
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

        $this->assertSoftDeleted(GameEvent::withTrashed()->where('type', 'FG3')->firstOrFail());
        $this->assertSame(0, LiveScore::where('event_id', $this->game->id)->value('away_score'));

        $this->deleteJson("/api/events/{$this->game->id}/plays/last")->assertOk();
        $this->deleteJson("/api/events/{$this->game->id}/plays/last")
            ->assertStatus(422)
            ->assertJsonPath('error', "There's nothing to undo yet.");
    }

    public function test_a_player_must_be_on_that_teams_roster_for_the_game(): void
    {
        $this->actingAsJudgeFor($this->game);
        $awayPlayer = $this->rostered($this->away, '4');
        $otherGame = $this->events()->create(['departments' => [$this->home->name, $this->away->name]]);
        $elsewhere = $this->rostered($this->home, '9', $otherGame);

        $this->play('FG2', $this->home, $awayPlayer)
            ->assertStatus(422)
            ->assertJsonPath('error', "That player isn't on this team's roster for this game.");
        $this->play('FG3', $this->home, $elsewhere)->assertStatus(422);
        $this->play('FG2', $this->departments()->create())->assertStatus(422)
            ->assertJsonPath('error', "That team isn't playing in this game.");

        $this->assertSame(0, GameEvent::count());
    }

    public function test_a_foul_needs_a_player_but_a_basket_does_not(): void
    {
        $this->actingAsJudgeFor($this->game);

        $this->play('FOUL', $this->home)
            ->assertStatus(422)
            ->assertJsonValidationErrors('playerId');

        $this->play('FG2', $this->home)->assertCreated();
    }

    // ── Periods ─────────────────────────────────────────────────────────

    public function test_team_fouls_count_per_period_and_personal_fouls_for_the_game(): void
    {
        $this->actingAsJudgeFor($this->game);
        $a = $this->rostered($this->home, '7');

        $this->play('FOUL', $this->home, $a);
        $board = $this->play('FOUL', $this->home, $a)->json();
        $this->assertSame(2, $this->team($board, $this->home)['teamFouls']);

        $board = $this->putJson("/api/events/{$this->game->id}/period", ['period' => 2])->assertOk()->json();
        $this->assertSame('Q2', $board['periodLabel']);
        $this->assertSame(0, $this->team($board, $this->home)['teamFouls']);
        $this->assertSame(2, collect($this->team($board, $this->home)['players'])->firstWhere('playerId', $a->id)['pf']);

        // Plays are stamped with the server's period.
        $this->play('FG2', $this->home);
        $this->assertSame(2, GameEvent::latest('id')->first()->period);
    }

    public function test_periods_past_regulation_are_labelled_as_overtime_and_need_a_tie(): void
    {
        $this->assertSame('Q4', BasketballScoreboard::periodLabel(4));
        $this->assertSame('OT1', BasketballScoreboard::periodLabel(5));
        $this->assertSame('OT2', BasketballScoreboard::periodLabel(6));

        $this->actingAsJudgeFor($this->game);
        foreach ([2, 3, 4] as $p) {
            $this->putJson("/api/events/{$this->game->id}/period", ['period' => $p])->assertOk();
        }

        $board = $this->putJson("/api/events/{$this->game->id}/period", ['period' => 5])->assertOk()->json();
        $this->assertSame('OT1', $board['periodLabel']);
        $this->assertSame('OT1', LiveScore::where('event_id', $this->game->id)->value('period'));

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

    // ── Finishing ───────────────────────────────────────────────────────

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

    // ── Access & live board ─────────────────────────────────────────────

    public function test_only_the_assigned_committee_or_an_admin_can_write(): void
    {
        $id = $this->game->id;
        $body = ['teamId' => $this->home->id, 'type' => 'FG2'];

        $this->getJson("/api/events/{$id}/scoreboard")->assertOk();
        $this->postJson("/api/events/{$id}/plays", $body)->assertUnauthorized();

        foreach (['coach', 'athlete'] as $role) {
            $this->actingAsRole($role);
            $this->postJson("/api/events/{$id}/plays", $body)->assertForbidden();
            $this->deleteJson("/api/events/{$id}/plays/last")->assertForbidden();
            $this->postJson("/api/events/{$id}/finish")->assertForbidden();
            $this->postJson("/api/events/{$id}/roster/sync")->assertForbidden();
        }

        // A committee member not assigned to this game.
        $this->actingAsRole('judge');
        $this->postJson("/api/events/{$id}/plays", $body)
            ->assertForbidden()
            ->assertJsonPath('error', 'You are not assigned to score this game.');
        $this->postJson("/api/events/{$id}/roster/sync")->assertForbidden();

        $this->assertSame(0, GameEvent::count());

        $this->actingAsRole('admin');
        $this->postJson("/api/events/{$id}/plays", $body)->assertCreated();
    }

    public function test_every_write_updates_the_live_board(): void
    {
        EventBus::fake([LiveScoreUpdated::class]);
        $this->actingAsJudgeFor($this->game);

        $this->play('FG3', $this->home)->assertCreated();
        EventBus::assertDispatched(LiveScoreUpdated::class, fn ($e) => $e->live['homeScore'] === 3 && $e->live['period'] === 'Q1');

        $this->deleteJson("/api/events/{$this->game->id}/plays/last");
        $this->putJson("/api/events/{$this->game->id}/period", ['period' => 2]);
        EventBus::assertDispatchedTimes(LiveScoreUpdated::class, 3);
    }

    public function test_a_rejected_play_changes_nothing_and_broadcasts_nothing(): void
    {
        EventBus::fake([LiveScoreUpdated::class]);
        $this->actingAsJudgeFor($this->game);

        $this->deleteJson("/api/events/{$this->game->id}/plays/last")->assertStatus(422);

        EventBus::assertNotDispatched(LiveScoreUpdated::class);
        $this->assertNull(LiveScore::where('event_id', $this->game->id)->first());
    }

    // ── Roster from athlete profiles ────────────────────────────────────

    public function test_the_roster_is_built_from_athlete_profiles(): void
    {
        $this->actingAsJudgeFor($this->game);

        // A registered athlete: the college lives on their account.
        $account = $this->users()->create(['role' => 'athlete', 'name' => 'Ana Reyes', 'department' => $this->home->name]);
        $reyes = $this->athletes()->create(['user_id' => $account->id, 'department' => null, 'jersey_number' => '4']);
        // A coach-added athlete stored under the college's abbreviation.
        $santos = $this->athletes()->create(['department' => 'CHH', 'first_name' => 'Ben', 'last_name' => 'Santos', 'jersey_number' => '00']);
        $aquino = $this->athletes()->create(['department' => $this->away->name, 'jersey_number' => '3']);
        // Left out: no jersey, another sport, inactive, a different college.
        $noJersey = $this->athletes()->create(['department' => $this->home->name, 'first_name' => 'Cy', 'last_name' => 'Cruz']);
        $this->athletes()->create(['department' => $this->home->name, 'sport' => 'Volleyball', 'jersey_number' => '9']);
        $this->athletes()->create(['department' => $this->home->name, 'status' => 'inactive', 'jersey_number' => '10']);
        $this->athletes()->create(['department' => 'College of Elsewhere', 'jersey_number' => '11']);

        $board = $this->sync()->assertOk()->json();

        $home = $this->team($board, $this->home);
        $this->assertSame(['00', '4'], array_column($home['players'], 'jersey'));
        $this->assertSame('Ana Reyes', collect($home['players'])->firstWhere('playerId', $reyes->id)['name']);
        $this->assertSame('Ben Santos', collect($home['players'])->firstWhere('playerId', $santos->id)['name']);
        $this->assertSame([$aquino->id], array_column($this->team($board, $this->away)['players'], 'playerId'));
        $this->assertSame(["{$this->home->name}: Cy Cruz has no jersey number yet."], $board['rosterNotes']);
        $this->assertNotContains($noJersey->id, GamePlayer::pluck('player_id')->all());
    }

    public function test_a_duplicate_jersey_is_left_off_with_a_note(): void
    {
        $this->actingAsJudgeFor($this->game);
        $this->athletes()->create(['department' => $this->home->name, 'first_name' => 'Al', 'last_name' => 'Abad', 'jersey_number' => '7']);
        $this->athletes()->create(['department' => $this->home->name, 'first_name' => 'Bo', 'last_name' => 'Bautista', 'jersey_number' => '7']);

        $board = $this->sync()->assertOk()->json();

        $this->assertCount(1, $this->team($board, $this->home)['players']);
        $this->assertSame(["{$this->home->name}: Bo Bautista shares #7 with a teammate and was left off."], $board['rosterNotes']);
    }

    public function test_resync_follows_profile_changes_but_keeps_players_who_have_plays(): void
    {
        $this->actingAsJudgeFor($this->game);
        $a = $this->athletes()->create(['department' => $this->home->name, 'jersey_number' => '4']);
        $b = $this->athletes()->create(['department' => $this->home->name, 'jersey_number' => '5']);
        $this->sync()->assertOk();
        $this->play('FG2', $this->home, $a)->assertCreated();

        // Swap-style changes, and $a (who has a basket) goes inactive.
        $a->update(['jersey_number' => '5', 'status' => 'inactive']);
        $b->update(['jersey_number' => '4']);

        $board = $this->sync()->assertOk()->json();
        $players = collect($this->team($board, $this->home)['players'])->keyBy('playerId');

        $this->assertSame('4', $players[$a->id]['jersey']);   // frozen as the play recorded it
        $this->assertSame(2, $players[$a->id]['pts']);
        $this->assertFalse($players->has($b->id));           // now clashes with the frozen #4
        $this->assertStringContainsString('shares #4', $board['rosterNotes'][0]);
    }

    public function test_the_coach_sets_a_unique_jersey_number_on_their_roster(): void
    {
        $coach = $this->actingAsRole('coach');
        $a = $this->athletes()->create(['coach_id' => $coach->id]);
        $b = $this->athletes()->create(['coach_id' => $coach->id, 'jersey_number' => '7']);

        $this->putJson("/api/athletes/{$a->id}", ['jerseyNumber' => '7'])
            ->assertStatus(422)->assertJsonValidationErrors('jerseyNumber');
        $this->putJson("/api/athletes/{$a->id}", ['jerseyNumber' => '100'])
            ->assertStatus(422)->assertJsonValidationErrors('jerseyNumber');

        $this->putJson("/api/athletes/{$a->id}", ['jerseyNumber' => '00'])
            ->assertOk()->assertJsonPath('jersey_number', '00');
        $this->putJson("/api/athletes/{$b->id}", ['jerseyNumber' => null])->assertOk();
        $this->assertNull($b->fresh()->jersey_number);

        // Another coach's athlete stays out of reach.
        $other = $this->athletes()->create(['coach_id' => $this->users()->create(['role' => 'coach'])->id]);
        $this->putJson("/api/athletes/{$other->id}", ['jerseyNumber' => '1'])->assertNotFound();
    }

    public function test_the_scoreboard_avoids_per_play_queries(): void
    {
        $players = collect(range(1, 8))->map(fn ($n) => $this->rostered($n % 2 ? $this->home : $this->away, (string) $n));
        foreach ($players as $p) {
            GameEvent::create(['game_id' => $this->game->id, 'team_id' => GamePlayer::where('player_id', $p->id)->value('team_id'),
                'player_id' => $p->id, 'type' => 'FG2', 'period' => 1]);
        }

        DB::enableQueryLog();
        app(BasketballScoreboard::class)->build($this->game->fresh());
        $this->assertLessThanOrEqual(7, count(DB::getQueryLog()));
    }
}
