<?php

namespace Tests\Feature;

use App\Models\BracketMatch;
use App\Models\Category;
use App\Models\Department;
use App\Models\Event;
use App\Models\GamePlayer;
use App\Services\BracketService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Game lineups for every head-to-head sport (Badminton and Table Tennis use
 * racquet lines), with each sport's positions; and brackets with a Men's /
 * Women's division, whose teams carry their lineup into the next round.
 */
class LineupSportsTest extends TestCase
{
    use RefreshDatabase;

    private Department $home;

    private Department $away;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['Sepak Takraw', 'Chess', 'Beach Volleyball', 'Badminton', 'Basketball'] as $sport) {
            Category::firstOrCreate(['name' => $sport], ['id' => (string) Str::uuid()]);
        }
        $this->home = $this->departments()->create(['name' => 'College Home Test', 'abbreviation' => 'CHT']);
        $this->away = $this->departments()->create(['name' => 'College Away Test', 'abbreviation' => 'CAT']);
    }

    private function coachWith(string $sport, int $players): array
    {
        $coach = $this->actingAsRole('coach', ['department' => $this->home->name, 'sports' => [$sport]]);
        $team = collect(range(1, $players))->map(fn ($i) => $this->athletes()->create([
            'coach_id' => $coach->id, 'sport' => $sport, 'jersey_number' => (string) $i,
        ]));

        return [$coach, $team];
    }

    private function game(string $sport): Event
    {
        return $this->events()->create(['category' => $sport, 'departments' => [$this->home->name, $this->away->name]]);
    }

    private function save(Event $game, $team, array $positions = [])
    {
        return $this->putJson("/api/events/{$game->id}/lineup", ['players' => $team->values()->map(fn ($a, $i) => [
            'playerId' => $a->id, 'jerseyNumber' => (string) ($i + 1), 'rotationPosition' => $positions[$i] ?? null,
        ])->all()]);
    }

    public function test_sepak_takraw_has_a_regu_of_tekong_feeder_and_striker(): void
    {
        [, $team] = $this->coachWith('Sepak Takraw', 5);
        $game = $this->game('Sepak Takraw');

        $this->getJson("/api/events/{$game->id}/lineup")->assertOk()
            ->assertJsonPath('sport', 'sepak takraw')
            ->assertJsonPath('positions', ['Tekong', 'Feeder', 'Striker'])
            ->assertJsonPath('max', 5);

        $this->save($game, $team, [1, 2])->assertStatus(422)
            ->assertJsonPath('error', 'The regu needs all three positions — Tekong, Feeder and Striker — or leave them empty.');
        $this->save($game, $team, [1, 2, 4])->assertStatus(422);           // there's no fourth position
        $this->save($game, $team, [3, 1, 2])->assertOk()->assertJsonPath('players.0.rotationPosition', 3);

        $this->getJson("/api/events/{$game->id}/lineups")->assertJsonPath('positions.0', 'Tekong');
    }

    public function test_chess_boards_and_a_squad_limit(): void
    {
        [, $team] = $this->coachWith('Chess', 7);
        $game = $this->game('Chess');

        $this->save($game, $team)->assertStatus(422)->assertJsonValidationErrors('players');   // 7 > 6
        $this->save($game, $team->take(6), [1, 2, 3, 4])->assertOk()
            ->assertJsonPath('positionName', 'Board');
    }

    public function test_beach_volleyball_is_just_the_players(): void
    {
        [, $team] = $this->coachWith('Beach Volleyball', 3);
        $game = $this->game('Beach Volleyball');

        $this->save($game, $team, [1])->assertStatus(422);   // no positions
        $this->save($game, $team)->assertOk()->assertJsonCount(3, 'players');
    }

    public function test_racquet_sports_use_racquet_lines_not_a_game_lineup(): void
    {
        [, $team] = $this->coachWith('Badminton', 2);
        $game = $this->game('Badminton');

        $this->getJson("/api/events/{$game->id}/lineup")->assertStatus(422)
            ->assertJsonPath('error', 'This sport has no game lineup (Badminton and Table Tennis use racquet lines).');
    }

    public function test_a_division_names_the_bracket_and_a_team_carries_its_lineup_forward(): void
    {
        $colleges = collect([$this->home, $this->away])
            ->merge([$this->departments()->create(), $this->departments()->create()]);
        $service = app(BracketService::class);

        $bracket = $service->generate([
            'sport' => 'Basketball', 'format' => 'single_elimination', 'division' => 'Women',
            'participants' => $colleges->pluck('name')->all(), 'startDate' => now()->addDay()->toDateString(), 'startTime' => '08:00',
        ]);
        $service->publish($bracket);

        $this->assertSame("Women's Basketball — Elimination", $bracket->fresh()->name);
        $first = BracketMatch::where('bracket_id', $bracket->id)->where('round', 1)->whereNotNull('event_id')->orderBy('slot')->first();
        $game = Event::find($first->event_id);
        $this->assertStringStartsWith("Women's Basketball (", $game->name);

        // The home side's lineup for round 1…
        $winner = $first->home_team;
        $team = Department::where('name', $winner)->first();
        $player = $this->athletes()->create(['department' => $winner]);
        GamePlayer::create(['game_id' => $game->id, 'team_id' => $team->id, 'player_id' => $player->id, 'jersey_number' => '7', 'rotation_position' => null]);

        // …comes with them when they win and advance.
        $service->advance($first, $winner);
        $final = BracketMatch::find($first->next_match_id);
        $this->assertNotNull($final->event_id);
        $carried = GamePlayer::where('game_id', $final->event_id)->where('team_id', $team->id)->get();
        $this->assertSame([$player->id], $carried->pluck('player_id')->all());
        $this->assertSame('7', $carried->first()->jersey_number);
    }
}
