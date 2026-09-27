<?php

namespace Tests\Feature;

use App\Models\Athlete;
use App\Models\Category;
use App\Models\Department;
use App\Models\Event;
use App\Models\GameEvent;
use App\Models\GamePlayer;
use App\Models\LiveScore;
use App\Models\TeamMatch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Play-by-play volleyball (the mobile scorer):
 *   GET    /api/events/{id}/volleyball            (public)
 *   PUT    /api/events/{id}/volleyball/best-of
 *   POST   /api/events/{id}/volleyball/sets
 *   POST   /api/events/{id}/volleyball/plays
 *   POST   /api/events/{id}/volleyball/subs
 *   DELETE /api/events/{id}/volleyball/plays/last
 *   POST   /api/events/{id}/volleyball/finish
 *
 * Everything is replayed from the plays: sets, score, serve, rotation.
 */
class VolleyballScoringTest extends TestCase
{
    use RefreshDatabase;

    private Department $home;

    private Department $away;

    private Event $game;

    /** @var array<string, array<int, Athlete>> team id => players; the first six are the default rotation I–VI */
    private array $players = [];

    protected function setUp(): void
    {
        parent::setUp();

        Category::firstOrCreate(['name' => 'Volleyball'], ['id' => (string) Str::uuid()]);
        $this->home = $this->departments()->create(['name' => 'College of Spikes Home', 'abbreviation' => 'CSH']);
        $this->away = $this->departments()->create(['name' => 'College of Spikes Away', 'abbreviation' => 'CSA']);
        $this->game = $this->events()->create([
            'category' => 'Volleyball',
            'departments' => [$this->home->name, $this->away->name],
        ]);

        foreach ([$this->home, $this->away] as $team) {
            foreach (range(1, 8) as $n) {
                $a = $this->athletes()->create(['department' => $team->name, 'sport' => 'Volleyball']);
                GamePlayer::create([
                    'game_id' => $this->game->id,
                    'team_id' => $team->id,
                    'player_id' => $a->id,
                    'jersey_number' => (string) $n,
                    'rotation_position' => $n <= 6 ? $n : null,
                ]);
                $this->players[$team->id][] = $a;
            }
        }
        $this->actingAsJudgeFor($this->game);
    }

    private function url(string $path = ''): string
    {
        return "/api/events/{$this->game->id}/volleyball{$path}";
    }

    private function startSet(Department $server, array $extra = [])
    {
        return $this->postJson($this->url('/sets'), ['firstServerTeamId' => $server->id, ...$extra]);
    }

    private function point(Department $team, string $type = 'KILL', ?Athlete $player = null)
    {
        return $this->postJson($this->url('/plays'), ['teamId' => $team->id, 'type' => $type, 'playerId' => $player?->id]);
    }

    /** Score `$n` opponent-error points in a row for a team. */
    private function streak(Department $team, int $n): array
    {
        $board = [];
        for ($i = 0; $i < $n; $i++) {
            $board = $this->point($team, 'OPP_ERROR')->assertCreated()->json();
        }

        return $board;
    }

    private function team(array $board, Department $team): array
    {
        return collect($board['teams'])->firstWhere('id', $team->id);
    }

    private function p(Department $team, int $i): Athlete
    {
        return $this->players[$team->id][$i];
    }

    // ── Rallies, serve and rotation ────────────────────────────────────

    public function test_rally_scoring_serve_and_rotation(): void
    {
        $board = $this->startSet($this->home)->assertCreated()->json();
        $this->assertTrue($board['setInProgress']);
        $this->assertSame(1, $board['currentSet']);
        $this->assertTrue($this->team($board, $this->home)['serving']);
        $this->assertSame($this->p($this->home, 0)->id, $this->team($board, $this->home)['serverPlayerId']); // position I

        // Serving team wins the rally: same server.
        $board = $this->point($this->home, 'KILL', $this->p($this->home, 3))->json();
        $this->assertSame($this->p($this->home, 0)->id, $this->team($board, $this->home)['serverPlayerId']);

        // Side-out: the away team rotates, position II now serves.
        $board = $this->point($this->away, 'BLOCK', $this->p($this->away, 2))->json();
        $away = $this->team($board, $this->away);
        $this->assertTrue($away['serving']);
        $this->assertFalse($this->team($board, $this->home)['serving']);
        $this->assertSame($this->p($this->away, 1)->id, $away['serverPlayerId']);
        $this->assertSame(1, $this->team($board, $this->home)['points']);
        $this->assertSame(1, $away['points']);

        $row = collect($this->team($board, $this->home)['players'])->firstWhere('playerId', $this->p($this->home, 3)->id);
        $this->assertSame(1, $row['kills']);
        $this->assertSame(1, $row['pts']);
        $this->assertSame('Set 1 · 1–1', LiveScore::where('event_id', $this->game->id)->value('period'));
        $this->assertSame(1, $board['log'][0]['set']);
        $this->assertSame([1, 1], [$board['log'][0]['homeScore'], $board['log'][0]['awayScore']]);
    }

    public function test_an_ace_belongs_to_the_serving_team_and_its_server(): void
    {
        $this->startSet($this->home);

        $this->point($this->away, 'ACE')->assertStatus(422)->assertJsonPath('error', 'Only the serving team can score an ace.');
        $this->point($this->home, 'ACE', $this->p($this->home, 2))->assertStatus(422)->assertJsonPath('error', 'An ace belongs to the server.');

        // No player picked: the server is credited.
        $board = $this->point($this->home, 'ACE')->assertCreated()->json();
        $server = collect($this->team($board, $this->home)['players'])->firstWhere('playerId', $this->p($this->home, 0)->id);
        $this->assertSame(1, $server['aces']);
    }

    public function test_only_players_on_court_score_and_an_opponent_error_has_no_player(): void
    {
        $this->startSet($this->home);

        $this->point($this->home, 'KILL', $this->p($this->home, 7))->assertStatus(422)
            ->assertJsonPath('error', 'That player is on the bench — only players on court can score.');
        $this->point($this->home, 'KILL', $this->p($this->away, 0))->assertStatus(422);
        $this->point($this->home, 'OPP_ERROR', $this->p($this->home, 0))->assertStatus(422);

        $board = $this->point($this->home, 'OPP_ERROR')->assertCreated()->json();
        $this->assertSame(1, $this->team($board, $this->home)['oppErrorPoints']);
    }

    public function test_nothing_is_recorded_before_a_set_starts(): void
    {
        $this->point($this->home)->assertStatus(422)->assertJsonPath('error', 'Start set 1 first.');
        $this->assertSame(0, GameEvent::count());
    }

    // ── Sets ────────────────────────────────────────────────────────────

    public function test_a_set_is_won_at_25_by_two_and_the_next_set_waits_to_be_started(): void
    {
        $this->startSet($this->home);
        $this->streak($this->home, 24);
        $board = $this->streak($this->away, 24);                    // 24–24: deuce
        $this->assertTrue($board['setInProgress']);

        $board = $this->streak($this->home, 1);                     // 25–24: not yet
        $this->assertTrue($board['setInProgress']);
        $board = $this->streak($this->home, 1);                     // 26–24
        $this->assertFalse($board['setInProgress']);
        $this->assertSame([['number' => 1, 'home' => 26, 'away' => 24, 'winnerTeamId' => $this->home->id]], $board['sets']);
        $this->assertSame(1, $this->team($board, $this->home)['setsWon']);

        // The next set is started explicitly; the other team serves first.
        $this->assertSame(2, $board['nextSet']['number']);
        $this->assertSame($this->away->id, $board['nextSet']['suggestedServerTeamId']);
        $this->point($this->home)->assertStatus(422)->assertJsonPath('error', 'Start set 2 first.');

        $live = LiveScore::where('event_id', $this->game->id)->first();
        $this->assertSame([1, 0], [$live->home_score, $live->away_score]);   // sets won on the board
        $this->assertSame([[26, 24]], $live->detail['sets']);
    }

    public function test_undo_works_across_a_set_boundary(): void
    {
        $this->startSet($this->home);
        $board = $this->streak($this->home, 25);
        $this->assertFalse($board['setInProgress']);

        $board = $this->deleteJson($this->url('/plays/last'))->assertOk()->json();
        $this->assertTrue($board['setInProgress']);
        $this->assertSame(24, $this->team($board, $this->home)['points']);
        $this->assertSame(0, $this->team($board, $this->home)['setsWon']);
    }

    public function test_the_deciding_set_is_played_to_15_and_the_match_then_finishes(): void
    {
        $this->startSet($this->home);
        $this->streak($this->home, 25);
        $this->startSet($this->away);
        $this->streak($this->away, 25);
        $board = $this->startSet($this->home)->json();
        $this->assertSame(15, $board['target']);

        $board = $this->streak($this->home, 15);
        $this->assertTrue($board['matchDecided']);
        $this->assertSame($this->home->id, $board['winnerTeamId']);
        $this->assertNull($board['nextSet']);

        $this->point($this->away)->assertStatus(422);
        $this->startSet($this->away)->assertStatus(422);

        $this->postJson($this->url('/finish'))->assertOk()->assertJsonPath('status', 'finished');
        $this->assertSame('completed', $this->game->fresh()->status);
        $match = TeamMatch::where('event_id', $this->game->id)->firstOrFail();
        $this->assertSame($this->home->name, $match->winner);
        $this->assertEquals(2, $match->home_score);                      // sets won
        $this->deleteJson($this->url('/plays/last'))->assertStatus(422); // finished is final
    }

    public function test_a_match_cannot_be_finished_before_it_is_decided(): void
    {
        $this->startSet($this->home);
        $this->streak($this->home, 25);

        $this->postJson($this->url('/finish'))->assertStatus(422)
            ->assertJsonPath('error', "The match isn't decided yet — a team needs 2 sets.");
    }

    public function test_best_of_five_can_only_be_set_before_the_first_set(): void
    {
        $board = $this->putJson($this->url('/best-of'), ['bestOf' => 5])->assertOk()->json();
        $this->assertSame(5, $board['bestOf']);
        $this->assertSame(3, $board['setsToWin']);
        $this->putJson($this->url('/best-of'), ['bestOf' => 4])->assertStatus(422);

        $this->startSet($this->home);
        $this->putJson($this->url('/best-of'), ['bestOf' => 3])->assertStatus(422);
    }

    // ── Timeouts and substitutions ──────────────────────────────────────

    public function test_two_timeouts_per_team_per_set(): void
    {
        $this->startSet($this->home);
        $this->point($this->home, 'TIMEOUT')->assertCreated();
        $board = $this->point($this->home, 'TIMEOUT')->assertCreated()->json();
        $this->assertSame(0, $this->team($board, $this->home)['timeoutsLeft']);
        $this->assertSame(0, $this->team($board, $this->home)['points']);   // a timeout isn't a point

        $this->point($this->home, 'TIMEOUT')->assertStatus(422);

        $this->streak($this->home, 25);
        $board = $this->startSet($this->away)->json();
        $this->assertSame(2, $this->team($board, $this->home)['timeoutsLeft']);
    }

    public function test_a_substitution_swaps_a_player_in_their_position(): void
    {
        $this->startSet($this->home);
        $out = $this->p($this->home, 0);   // position I, serving
        $in = $this->p($this->home, 6);

        $this->postJson($this->url('/subs'), ['teamId' => $this->home->id, 'playerOutId' => $in->id, 'playerInId' => $out->id])
            ->assertStatus(422);   // the one "coming off" is on the bench

        $board = $this->postJson($this->url('/subs'), ['teamId' => $this->home->id, 'playerOutId' => $out->id, 'playerInId' => $in->id])
            ->assertCreated()->json();
        $home = $this->team($board, $this->home);
        $this->assertSame($in->id, $home['serverPlayerId']);      // took position I
        $this->assertSame(5, $home['substitutionsLeft']);
        $this->point($this->home, 'KILL', $out)->assertStatus(422);  // now on the bench
        $this->point($this->home, 'KILL', $in)->assertCreated();
    }

    // ── Starting a set ──────────────────────────────────────────────────

    public function test_a_set_starts_from_the_coaches_rotation_or_one_the_scorer_gives(): void
    {
        $ids = fn (Department $t, array $idx) => array_map(fn ($i) => $this->p($t, $i)->id, $idx);

        $this->startSet($this->home, ['rotations' => [$this->home->id => [...$ids($this->home, [0, 1, 2, 3, 4]), $this->p($this->away, 0)->id]]])
            ->assertStatus(422);   // an opponent in our rotation

        $custom = $ids($this->home, [7, 6, 5, 4, 3, 2]);
        $board = $this->startSet($this->home, ['rotations' => [$this->home->id => $custom, $this->away->id => null]])
            ->assertCreated()->json();

        $this->assertSame($custom, $this->team($board, $this->home)['rotation']);
        $this->assertSame($this->p($this->home, 7)->id, $this->team($board, $this->home)['serverPlayerId']);
        // No rotation for away: its serve is tracked, not its server.
        $this->assertNull($this->team($board, $this->away)['rotation']);
        $board = $this->point($this->away)->json();
        $this->assertTrue($this->team($board, $this->away)['serving']);
        $this->assertNull($this->team($board, $this->away)['serverPlayerId']);

        $this->startSet($this->home)->assertStatus(422)->assertJsonPath('error', 'Set 1 is still being played.');
    }

    // ── Access and sport ────────────────────────────────────────────────

    public function test_only_the_assigned_committee_or_an_admin_can_write(): void
    {
        $this->getJson($this->url())->assertOk()->assertJsonPath('sport', 'volleyball');

        foreach (['coach', 'athlete', 'judge'] as $role) {
            $this->actingAsRole($role);
            $this->startSet($this->home)->assertForbidden();
        }
        $this->actingAsRole('admin');
        $this->startSet($this->home)->assertCreated();
    }

    public function test_each_scorer_only_scores_its_own_sport(): void
    {
        $this->postJson("/api/events/{$this->game->id}/plays", ['teamId' => $this->home->id, 'type' => 'FG2'])
            ->assertStatus(422)->assertJsonPath('error', "This game isn't scored as basketball.");

        $hoops = $this->events()->create(['category' => 'Basketball', 'departments' => [$this->home->name, $this->away->name]]);
        $this->actingAsJudgeFor($hoops);
        $this->postJson("/api/events/{$hoops->id}/volleyball/sets", ['firstServerTeamId' => $this->home->id])
            ->assertStatus(422)->assertJsonPath('error', "This game isn't scored as volleyball.");
    }

    // ── The coach's starting rotation ───────────────────────────────────

    public function test_the_coach_sets_a_full_starting_rotation_or_none(): void
    {
        $coach = $this->actingAsRole('coach', ['department' => $this->home->name, 'department_id' => $this->home->id, 'sports' => ['Volleyball']]);
        $mine = collect(range(1, 7))->map(fn () => $this->athletes()->create(['coach_id' => $coach->id, 'sport' => 'Volleyball']));
        $players = fn (int $positions) => $mine->values()->map(fn ($a, $i) => [
            'playerId' => $a->id,
            'jerseyNumber' => (string) ($i + 10),
            'rotationPosition' => $i < $positions ? $i + 1 : null,
        ])->all();

        $this->putJson("/api/events/{$this->game->id}/lineup", ['players' => $players(4)])
            ->assertStatus(422)
            ->assertJsonPath('error', 'A starting rotation needs all six positions, I to VI — or leave it empty.');

        $this->putJson("/api/events/{$this->game->id}/lineup", ['players' => $players(6)])
            ->assertOk()
            ->assertJsonPath('sport', 'volleyball')
            ->assertJsonPath('players.0.rotationPosition', 1);

        $this->getJson('/api/coach/lineups')->assertJsonPath('games.0.sport', 'volleyball');

        // The scorer's next set starts from it.
        $this->actingAsJudgeFor($this->game);
        $board = $this->startSet($this->home)->json();
        $this->assertSame($mine->take(6)->pluck('id')->all(), $this->team($board, $this->home)['rotation']);
    }
}
