<?php

namespace Tests\Feature;

use App\Events\LiveScoreUpdated;
use App\Models\Athlete;
use App\Models\Category;
use App\Models\Department;
use App\Models\Event;
use App\Models\GameEvent;
use App\Models\GamePlayer;
use App\Models\LiveScore;
use App\Models\TeamMatch;
use App\Models\User;
use App\Services\BasketballScoreboard;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event as EventBus;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Play-by-play basketball scoring (the mobile scorer):
 *   GET    /api/events/{id}/scoreboard        (public)
 *   POST   /api/events/{id}/plays             (scorekeeper)
 *   DELETE /api/events/{id}/plays/last        (scorekeeper)
 *   PUT    /api/events/{id}/period            (scorekeeper)
 *   POST   /api/events/{id}/finish            (scorekeeper)
 * plus the coach's side: an athlete's default jersey number
 * (PUT /api/athletes/{id}) and each game's lineup
 * (GET /api/coach/lineups, GET|PUT /api/events/{id}/lineup).
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

        Category::firstOrCreate(['name' => 'Basketball'], ['id' => (string) Str::uuid()]);
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

    /** A basketball coach for this college, signed in. */
    private function coachOf(Department $college): User
    {
        return $this->actingAsRole('coach', [
            'department' => $college->name,
            'department_id' => $college->id,
            'sports' => ['Basketball'],
        ]);
    }

    private function lineup(array $players)
    {
        return $this->putJson("/api/events/{$this->game->id}/lineup", ['players' => $players]);
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
        }

        // A committee member not assigned to this game.
        $this->actingAsRole('judge');
        $this->postJson("/api/events/{$id}/plays", $body)
            ->assertForbidden()
            ->assertJsonPath('error', 'You are not assigned to score this game.');
        // …and the committee doesn't set lineups.
        $this->putJson("/api/events/{$id}/lineup", ['players' => []])->assertForbidden();

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

    // ── The coach's lineup ──────────────────────────────────────────────

    public function test_the_coach_lines_up_their_own_athletes_and_the_scorer_sees_them(): void
    {
        $coach = $this->coachOf($this->home);
        $account = $this->users()->create(['role' => 'athlete', 'name' => 'Ana Reyes']);
        $reyes = $this->athletes()->create(['coach_id' => $coach->id, 'user_id' => $account->id, 'jersey_number' => '4']);
        $santos = $this->athletes()->create(['coach_id' => $coach->id, 'first_name' => 'Ben', 'last_name' => 'Santos']);
        // Not offered: inactive, another sport, another coach's athlete.
        $this->athletes()->create(['coach_id' => $coach->id, 'status' => 'inactive']);
        $this->athletes()->create(['coach_id' => $coach->id, 'sport' => 'Volleyball']);
        $theirs = $this->athletes()->create();

        $this->getJson('/api/coach/lineups')
            ->assertOk()
            ->assertJsonPath('games.0.id', $this->game->id)
            ->assertJsonPath('games.0.opponent', $this->away->name)
            ->assertJsonPath('games.0.lineupCount', 0);

        $this->getJson("/api/events/{$this->game->id}/lineup")
            ->assertOk()
            ->assertJsonPath('team.id', $this->home->id)
            ->assertJsonCount(2, 'candidates')
            ->assertJsonPath('candidates.0.name', 'Ana Reyes')
            ->assertJsonPath('candidates.0.jerseyNumber', '4');   // the profile number as a default

        $this->lineup([['playerId' => $theirs->id, 'jerseyNumber' => '9']])
            ->assertStatus(422)
            ->assertJsonPath('error', 'Only active athletes on your roster for this sport can be lined up.');
        $this->lineup([['playerId' => $reyes->id, 'jerseyNumber' => '4'], ['playerId' => $santos->id, 'jerseyNumber' => '4']])
            ->assertStatus(422);

        $this->lineup([['playerId' => $reyes->id, 'jerseyNumber' => '4'], ['playerId' => $santos->id, 'jerseyNumber' => '00']])
            ->assertOk()
            ->assertJsonCount(2, 'players')
            ->assertJsonPath('players.0.jerseyNumber', '00');

        // The committee's scorer credits exactly this lineup.
        $this->actingAsJudgeFor($this->game);
        $board = $this->getJson("/api/events/{$this->game->id}/scoreboard")->json();
        $this->assertSame(['00', '4'], array_column($this->team($board, $this->home)['players'], 'jersey'));
        $this->assertSame([], $this->team($board, $this->away)['players']);   // their coach hasn't lined up yet
        $this->play('FG3', $this->home, $santos)->assertCreated();
        $this->play('FG2', $this->home, $theirs)->assertStatus(422);
    }

    public function test_a_coach_only_lines_up_their_own_college_in_their_sport(): void
    {
        $this->coachOf($this->departments()->create());
        $this->getJson("/api/events/{$this->game->id}/lineup")->assertForbidden();
        $this->getJson('/api/coach/lineups')->assertOk()->assertJsonCount(0, 'games');

        $this->actingAsRole('coach', ['department' => $this->home->name, 'department_id' => $this->home->id, 'sports' => ['Volleyball']]);
        $this->getJson("/api/events/{$this->game->id}/lineup")->assertForbidden();

        $this->actingAsRole('athlete');
        $this->getJson("/api/events/{$this->game->id}/lineup")->assertForbidden();
    }

    public function test_players_with_plays_stay_in_the_lineup_under_their_number(): void
    {
        $coach = $this->coachOf($this->home);
        $a = $this->athletes()->create(['coach_id' => $coach->id]);
        $b = $this->athletes()->create(['coach_id' => $coach->id]);
        $this->lineup([['playerId' => $a->id, 'jerseyNumber' => '4'], ['playerId' => $b->id, 'jerseyNumber' => '5']])->assertOk();

        $judge = $this->actingAsJudgeFor($this->game);
        $this->play('FG2', $this->home, $a)->assertCreated();
        $this->loginAs($coach);

        $this->lineup([['playerId' => $b->id, 'jerseyNumber' => '5']])->assertStatus(422);
        $this->lineup([['playerId' => $a->id, 'jerseyNumber' => '8'], ['playerId' => $b->id, 'jerseyNumber' => '5']])->assertStatus(422);

        // Others can still change, including taking a freed number.
        $this->lineup([['playerId' => $a->id, 'jerseyNumber' => '4'], ['playerId' => $b->id, 'jerseyNumber' => '10']])
            ->assertOk()
            ->assertJsonPath('players.0.hasPlays', true);

        // Once the game is finished the lineup is locked.
        $this->loginAs($judge);
        $this->postJson("/api/events/{$this->game->id}/finish")->assertOk();
        $this->loginAs($coach);
        $this->lineup([['playerId' => $a->id, 'jerseyNumber' => '4']])->assertStatus(422);
        $this->getJson('/api/coach/lineups')->assertJsonCount(0, 'games');   // completed games drop off
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

    public function test_anyone_can_see_both_lineups_but_only_numbers_and_names(): void
    {
        $account = $this->users()->create(['role' => 'athlete', 'name' => 'Ana Reyes', 'email' => 'ana@batstate-u.edu.ph']);
        $reyes = $this->athletes()->create(['department' => $this->home->name, 'user_id' => $account->id, 'student_id' => '24-11111']);
        GamePlayer::create(['game_id' => $this->game->id, 'team_id' => $this->home->id, 'player_id' => $reyes->id, 'jersey_number' => '10']);
        $this->rostered($this->home, '4');

        $res = $this->getJson("/api/events/{$this->game->id}/lineups")   // no sign-in
            ->assertOk()
            ->assertJsonPath('sport', 'basketball')
            ->assertJsonPath('teams.0.id', $this->home->id)
            ->assertJsonPath('teams.0.players.0.jersey', '4')
            ->assertJsonPath('teams.0.players.1.name', 'Ana Reyes')
            ->assertJsonPath('teams.1.players', []);

        $this->assertStringNotContainsString('24-11111', $res->getContent());
        $this->assertStringNotContainsString('ana@batstate-u.edu.ph', $res->getContent());
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
