<?php

namespace Tests\Feature;

use App\Models\BracketMatch;
use App\Services\BracketService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * GET /api/leaderboard — the college medal table.
 *
 *   ranked sports → each event's top 3 = gold / silver / bronze
 *   versus sports → medals come only from a finished tournament, never from a
 *                   single game
 */
class LeaderboardTest extends TestCase
{
    use RefreshDatabase;

    private function board(?string $category = null): array
    {
        $url = '/api/leaderboard'.($category ? '?category='.urlencode($category) : '');

        return $this->getJson($url)->assertOk()->json();
    }

    private function row(array $board, string $dept): array
    {
        return collect($board)->firstWhere('department', $dept) ?? [];
    }

    public function test_a_ranked_sport_awards_medals_from_each_events_placement(): void
    {
        $this->categories()->create(['name' => 'Cheerdance', 'format' => 'ranked']);
        $event = $this->events()->create(['category' => 'Cheerdance']);

        $this->scores()->create(['event_id' => $event->id, 'department' => 'CET',     'total_score' => 95]);
        $this->scores()->create(['event_id' => $event->id, 'department' => 'CICS',    'total_score' => 90]);
        $this->scores()->create(['event_id' => $event->id, 'department' => 'CABEIHM', 'total_score' => 80]);

        $board = $this->board();

        $this->assertSame(1, $this->row($board, 'CET')['gold']);
        $this->assertSame(1, $this->row($board, 'CICS')['silver']);
        $this->assertSame(1, $this->row($board, 'CABEIHM')['bronze']);
        $this->assertEquals(95, $this->row($board, 'CET')['total']);
    }

    public function test_a_versus_game_does_not_mint_medals(): void
    {
        $this->departments()->create(['name' => 'CET']);
        $this->departments()->create(['name' => 'CICS']);
        $this->categories()->create(['name' => 'Basketball', 'format' => 'versus']);
        $event = $this->events()->create(['category' => 'Basketball', 'departments' => ['CET', 'CICS']]);

        // Both colleges get committee scores → a 2-row per-game ranking exists…
        $this->scores()->create(['event_id' => $event->id, 'department' => 'CET',  'total_score' => 78]);
        $this->scores()->create(['event_id' => $event->id, 'department' => 'CICS', 'total_score' => 64]);

        $board = $this->board();

        // …but no medals are awarded (no bracket = no tournament podium).
        $this->assertSame(0, $this->row($board, 'CET')['gold']);
        $this->assertSame(0, $this->row($board, 'CICS')['silver']);
        $this->assertEquals(0, $this->row($board, 'CET')['total']);
        $this->assertSame(0, collect($board)->sum('gold') + collect($board)->sum('silver') + collect($board)->sum('bronze'));
    }

    public function test_a_completed_elimination_bracket_awards_the_podium(): void
    {
        $this->actingAsRole('admin');
        $this->categories()->create(['name' => 'Basketball', 'format' => 'versus']);

        $service = app(BracketService::class);
        $bracket = $service->generate([
            'sport' => 'Basketball',
            'format' => 'single_elimination',
            'participants' => ['CICS', 'CET', 'CABEIHM', 'CAS'],
            'startDate' => '2026-10-01',
            'startTime' => '09:00',
        ]);
        $service->publish($bracket);

        // Home team wins every game.
        foreach (BracketMatch::where('bracket_id', $bracket->id)->where('round', 1)->get() as $semi) {
            $service->advance($semi->fresh(), $semi->home_team);
        }
        $final = BracketMatch::where('bracket_id', $bracket->id)->where('round', 2)->first();
        $service->advance($final->fresh(), $final->fresh()->home_team);

        $bracket->refresh();
        $gold = $bracket->champion;

        $board = $this->board();

        $this->assertSame(1, $this->row($board, $gold)['gold']);
        $this->assertSame(1, collect($board)->sum('silver'));  // exactly one silver awarded
        $this->assertSame(2, collect($board)->sum('bronze'));  // both semi-final losers
    }

    public function test_a_group_stage_followed_by_playoffs_does_not_mint_its_own_medals(): void
    {
        $this->actingAsRole('admin');
        $this->categories()->create(['name' => 'Basketball — Men', 'format' => 'versus']);
        $service = app(BracketService::class);
        $teams = ['CICS', 'CET', 'CABEIHM', 'CAS'];

        // A fully played round robin…
        $group = $service->generate(['sport' => 'Basketball — Men', 'format' => 'round_robin', 'participants' => $teams, 'startDate' => '2026-10-01', 'startTime' => '09:00']);
        $service->publish($group);
        foreach (BracketMatch::where('bracket_id', $group->id)->get() as $k => $m) {
            // The standings come from the recorded results.
            $this->teamMatches()->create([
                'sport' => 'Basketball — Men', 'stage' => 'group', 'event_id' => $m->event_id,
                'home_team' => $m->home_team, 'away_team' => $m->away_team,
                'home_score' => 70 + $k, 'away_score' => 60, 'winner' => $m->home_team, 'is_draw' => false, 'status' => 'completed',
            ]);
            $service->advance($m->fresh(), $m->home_team);
        }
        $this->assertSame(3, collect($this->board())->sum(fn ($r) => $r['gold'] + $r['silver'] + $r['bronze']));   // alone, it's the podium

        // …then playoffs in the same sport: only the playoffs' podium counts.
        $playoffs = $service->generate(['sport' => 'Basketball — Men', 'format' => 'single_elimination', 'participants' => $teams, 'startDate' => '2026-10-05', 'startTime' => '09:00']);
        $service->publish($playoffs);
        foreach (BracketMatch::where('bracket_id', $playoffs->id)->where('round', 1)->get() as $semi) {
            $service->advance($semi->fresh(), $semi->away_team);
        }
        $final = BracketMatch::where('bracket_id', $playoffs->id)->where('round', 2)->first()->fresh();
        $service->advance($final, $final->away_team);
        Cache::flush();

        $board = $this->board();
        $this->assertSame(1, collect($board)->sum('gold'));
        $this->assertSame(1, $this->row($board, $playoffs->fresh()->champion)['gold']);
        $this->assertSame(2, collect($board)->sum('bronze'));
    }

    public function test_the_medal_table_can_be_filtered_by_sport(): void
    {
        $this->categories()->create(['name' => 'Swimming 50m', 'format' => 'ranked']);
        $this->categories()->create(['name' => 'Track 100m', 'format' => 'ranked']);
        $swim = $this->events()->create(['category' => 'Swimming 50m']);
        $track = $this->events()->create(['category' => 'Track 100m']);
        $this->scores()->create(['event_id' => $swim->id,  'department' => 'CET', 'total_score' => 50]);
        $this->scores()->create(['event_id' => $track->id, 'department' => 'CET', 'total_score' => 50]);

        $this->assertSame(1, $this->row($this->board('Swimming 50m'), 'CET')['gold']);
        $this->assertSame(2, $this->row($this->board(), 'CET')['gold']);
    }
}
