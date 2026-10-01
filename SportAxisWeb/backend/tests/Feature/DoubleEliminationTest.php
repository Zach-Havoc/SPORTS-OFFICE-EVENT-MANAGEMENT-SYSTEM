<?php

namespace Tests\Feature;

use App\Models\Bracket;
use App\Models\BracketMatch;
use App\Models\Department;
use App\Models\Event;
use App\Services\BracketService;
use Database\Seeders\DoubleEliminationSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Double elimination: upper bracket, lower bracket, grand final + reset.
 *
 * Covers: the shape for every field size (2N-2 games, +1 reset), byes never
 * leaving a lower match half-empty, every team out after exactly two losses
 * whatever the results, the reset (skipped / played / its event appearing and
 * disappearing), corrections re-routing the lower bracket, the podium, and
 * the API.
 */
class DoubleEliminationTest extends TestCase
{
    use RefreshDatabase;

    private function service(): BracketService
    {
        return app(BracketService::class);
    }

    private function teams(int $n): array
    {
        return array_map(fn ($i) => "College {$i}", range(1, $n));
    }

    private function generate(int $n, array $overrides = []): Bracket
    {
        return $this->service()->generate(array_merge([
            'sport' => 'Basketball',
            'format' => 'double_elimination',
            'participants' => $this->teams($n),
            'startDate' => '2026-10-01',
            'startTime' => '09:00',
            'matchDuration' => 60,
            'breakDuration' => 15,
        ], $overrides));
    }

    private function rows(Bracket $bracket)
    {
        return BracketMatch::where('bracket_id', $bracket->id)->get();
    }

    private function find(Bracket $bracket, string $section, ?string $label = null): BracketMatch
    {
        return $this->rows($bracket)
            ->filter(fn ($m) => $m->section === $section && ($label === null || $m->stage_label === $label))
            ->sortBy([['round', 'asc'], ['slot', 'asc']])
            ->first();
    }

    /** Record the next playable match, the winner picked by `$pick`; false when nothing is left. */
    private function playNext(Bracket $bracket, callable $pick): bool
    {
        $next = $this->rows($bracket)
            ->filter(fn ($m) => ! $m->is_bye && in_array($m->status, ['ready', 'scheduled'], true))
            ->sortBy([['round', 'asc'], ['slot', 'asc']])
            ->first();
        if (! $next) {
            return false;
        }
        $this->service()->advance($next, $pick($next));

        return true;
    }

    // ── Shape ──────────────────────────────────────────────────────────

    public function test_every_field_size_gets_2n_minus_2_games_plus_the_reset(): void
    {
        foreach (range(3, 17) as $n) {
            $bracket = $this->generate($n);
            $matches = $this->rows($bracket);
            $size = 2 ** (int) ceil(log($n, 2));

            $this->assertSame('double_elimination', $bracket->format, "n={$n}");
            $this->assertCount($size - $n, $matches->where('is_bye', true), "byes, n={$n}");
            $games = $matches->where('is_bye', false);
            $this->assertCount(2 * $n - 1, $games, "games incl. reset, n={$n}");
            $this->assertCount($n - 1, $games->where('section', 'upper'), "upper games, n={$n}");
            $this->assertCount($n - 2, $games->where('section', 'lower'), "lower games, n={$n}");
            $this->assertCount(2, $games->where('section', 'grand_final'), "grand final, n={$n}");

            // Every lower match is a real game fed from both sides, and every
            // source is played earlier (a lower round).
            foreach ($matches as $m) {
                if ($m->section === 'lower') {
                    $this->assertFalse($m->is_bye, "n={$n}");
                    $this->assertNotNull($m->home_source_match_id, "n={$n}");
                    $this->assertNotNull($m->away_source_match_id, "n={$n}");
                }
                foreach ([$m->home_source_match_id, $m->away_source_match_id] as $src) {
                    if ($src) {
                        $this->assertLessThan($m->round, $matches->firstWhere('id', $src)->round, "play order, n={$n}");
                    }
                }
            }
        }
    }

    public function test_without_a_reset_it_is_exactly_2n_minus_2_games(): void
    {
        $bracket = $this->generate(6, ['grandFinalReset' => false]);
        $games = $this->rows($bracket)->where('is_bye', false);

        $this->assertCount(10, $games);
        $this->assertCount(1, $games->where('section', 'grand_final'));
        $this->assertFalse($bracket->settings['grandFinalReset']);
    }

    public function test_labels_name_each_part_of_the_bracket(): void
    {
        $bracket = $this->generate(8);
        $labels = $this->rows($bracket)->pluck('stage_label')->unique()->values()->all();

        foreach (['Upper Quarter-Finals', 'Upper Semi-Finals', 'Upper Finals', 'Lower Round 1', 'Lower Round 2', 'Lower Round 3', 'Lower Final', 'Grand Final', 'Grand Final (Reset)'] as $label) {
            $this->assertContains($label, $labels);
        }
        $this->assertStringEndsWith('Double Elimination', $bracket->name);
    }

    public function test_fewer_than_three_participants_is_rejected(): void
    {
        $this->expectException(ValidationException::class);
        $this->generate(2);
    }

    // ── Progression ────────────────────────────────────────────────────

    public function test_whatever_the_results_every_team_but_the_champion_goes_out_on_two_losses(): void
    {
        foreach ([3, 4, 5, 6, 7, 8, 9, 12] as $n) {
            foreach ([11, 29, 47] as $seed) {
                mt_srand($seed * $n);
                $bracket = $this->generate($n);
                $guard = 0;
                while ($this->playNext($bracket, fn ($m) => mt_rand(0, 1) ? $m->home_team : $m->away_team)) {
                    $this->assertLessThan(4 * $n, ++$guard, 'bracket never finishes');
                }

                $bracket->refresh();
                $played = $this->rows($bracket)->where('is_bye', false)->where('status', 'completed');
                $losses = $played->countBy('loser');
                $champion = $bracket->champion;

                $this->assertSame('completed', $bracket->status, "n={$n} seed={$seed}");
                $this->assertNotNull($champion);
                $this->assertLessThanOrEqual(1, $losses[$champion] ?? 0);
                foreach ($this->teams($n) as $team) {
                    if ($team !== $champion) {
                        $this->assertSame(2, $losses[$team] ?? 0, "{$team} losses, n={$n} seed={$seed}");
                    }
                }
                // No game ever had the same team twice or an empty side.
                foreach ($played as $m) {
                    $this->assertNotNull($m->home_team);
                    $this->assertNotNull($m->away_team);
                    $this->assertNotSame($m->home_team, $m->away_team);
                }
                $this->assertContains($played->count(), [2 * $n - 2, 2 * $n - 1]);
            }
        }
    }

    public function test_the_reset_is_skipped_when_the_upper_champion_wins_the_grand_final(): void
    {
        $bracket = $this->generate(4);
        // Home side wins everything: the upper champion is home in the grand final.
        while ($this->playNext($bracket, fn ($m) => $m->home_team)) {
        }

        $bracket->refresh();
        $gf = $this->find($bracket, 'grand_final', 'Grand Final');
        $reset = $this->find($bracket, 'grand_final', 'Grand Final (Reset)');

        $this->assertSame('completed', $bracket->status);
        $this->assertSame($gf->home_team, $bracket->champion);
        $this->assertSame('skipped', $reset->status);
        $this->assertNull($reset->home_team);
        $this->assertNull($reset->away_team);
    }

    public function test_the_reset_decides_it_when_the_lower_champion_wins_the_grand_final(): void
    {
        $bracket = $this->generate(4);
        $gfId = $this->find($bracket, 'grand_final', 'Grand Final')->id;
        // Home wins everything except the grand final, which the lower champion (away) takes.
        while ($this->playNext($bracket, fn ($m) => $m->id === $gfId ? $m->away_team : $m->home_team)) {
            if ($this->rows($bracket)->firstWhere('id', $gfId)->status === 'completed') {
                break;
            }
        }

        $gf = BracketMatch::find($gfId);
        $reset = $this->find($bracket, 'grand_final', 'Grand Final (Reset)');
        $this->assertSame('ready', $reset->status);
        $this->assertSame($gf->home_team, $reset->home_team);   // the upper champion, at home again
        $this->assertSame($gf->away_team, $reset->away_team);
        $this->assertNull($bracket->fresh()->champion);         // one loss each — not over

        $this->service()->advance($reset, $reset->away_team);
        $this->assertSame($gf->away_team, $bracket->fresh()->champion);
        $this->assertSame('completed', $bracket->fresh()->status);
    }

    public function test_correcting_an_upper_result_reroutes_the_lower_bracket(): void
    {
        $bracket = $this->generate(4);
        $semis = $this->rows($bracket)->where('section', 'upper')->where('round', 1)->sortBy('slot')->values();
        $this->service()->advance($semis[0], $semis[0]->home_team);
        $this->service()->advance($semis[1], $semis[1]->home_team);

        $lower = $this->find($bracket, 'lower', 'Lower Round 1');
        $this->assertEqualsCanonicalizing([$semis[0]->away_team, $semis[1]->away_team], [$lower->home_team, $lower->away_team]);

        // Semi 1 is corrected: its home side lost after all.
        $this->service()->advance($semis[0]->fresh(), $semis[0]->away_team, force: true);
        $lower->refresh();
        $this->assertEqualsCanonicalizing([$semis[0]->home_team, $semis[1]->away_team], [$lower->home_team, $lower->away_team]);
    }

    // ── Events ─────────────────────────────────────────────────────────

    public function test_the_reset_game_goes_on_the_calendar_only_when_needed(): void
    {
        $bracket = $this->generate(4);
        $this->service()->publish($bracket->fresh('matches'));

        $reset = $this->find($bracket, 'grand_final', 'Grand Final (Reset)');
        $this->assertNull($reset->event_id);
        $this->assertSame(6, Event::count());      // 2N-2 games, no reset yet
        $this->assertSame(6, Event::withTrashed()->count());   // not even one made and thrown away

        $gfId = $this->find($bracket, 'grand_final', 'Grand Final')->id;
        while ($this->playNext($bracket, fn ($m) => $m->id === $gfId ? $m->away_team : $m->home_team)) {
            if (BracketMatch::find($gfId)->status === 'completed') {
                break;
            }
        }

        $reset->refresh();
        $this->assertSame('scheduled', $reset->status);
        $this->assertNotNull($reset->event_id);
        $event = Event::find($reset->event_id);
        $this->assertStringContainsString('Grand Final (Reset)', $event->name);
        $this->assertEqualsCanonicalizing([$reset->home_team, $reset->away_team], $event->departments);

        // The grand final is corrected — the upper champion won it. No reset.
        $gf = BracketMatch::find($gfId);
        $this->service()->advance($gf, $gf->home_team, force: true);
        $reset->refresh();
        $this->assertSame('skipped', $reset->status);
        $this->assertNull($reset->event_id);
        $this->assertSoftDeleted('events', ['id' => $event->id]);
        $this->assertSame($gf->home_team, $bracket->fresh()->champion);
    }

    // ── Standings + API ────────────────────────────────────────────────

    public function test_the_podium_is_champion_grand_final_loser_and_lower_final_loser(): void
    {
        $this->categories()->create(['name' => 'Basketball', 'format' => 'versus']);
        $bracket = $this->generate(5);
        $this->service()->publish($bracket->fresh('matches'));
        while ($this->playNext($bracket, fn ($m) => $m->home_team)) {
        }

        $bracket->refresh();
        $gf = $this->find($bracket, 'grand_final', 'Grand Final');
        $lowerFinal = $this->find($bracket, 'lower', 'Lower Final');
        $board = collect($this->getJson('/api/leaderboard')->assertOk()->json())->keyBy('department');

        $this->assertSame(1, $board[$bracket->champion]['gold']);
        $this->assertSame(1, $board[$gf->away_team]['silver']);
        $this->assertSame(1, $board[$lowerFinal->loser]['bronze']);
        $this->assertSame(1, $board->sum('gold'));
        $this->assertSame(1, $board->sum('silver'));
        $this->assertSame(1, $board->sum('bronze'));
    }

    public function test_the_api_creates_a_double_elimination_bracket(): void
    {
        $this->actingAsRole('admin');

        $res = $this->postJson('/api/brackets', [
            'sport' => 'Volleyball',
            'format' => 'double_elimination',
            'participants' => $this->teams(6),
            'startDate' => '2026-10-01',
            'startTime' => '08:00',
            'grandFinalReset' => false,
        ])->assertCreated();

        $this->assertSame('double_elimination', $res->json('format'));
        $this->assertFalse($res->json('settings.grandFinalReset'));
        $sections = collect($res->json('matches'))->pluck('section')->unique()->sort()->values()->all();
        $this->assertSame(['grand_final', 'lower', 'upper'], $sections);

        $this->postJson('/api/brackets', [
            'sport' => 'Volleyball', 'format' => 'double_elimination', 'participants' => $this->teams(2),
            'startDate' => '2026-10-01', 'startTime' => '08:00',
        ])->assertStatus(422)->assertJsonValidationErrors('participants');
    }

    // ── Seeder ─────────────────────────────────────────────────────────

    public function test_the_seeder_adds_one_draft_sample_and_is_safe_to_rerun(): void
    {
        foreach (['CICS', 'CET', 'CAS', 'CTE', 'CABEIHM'] as $name) {
            Department::create(['id' => (string) Str::uuid(), 'name' => $name, 'abbreviation' => $name]);
        }

        $this->seed(DoubleEliminationSeeder::class);
        $this->seed(DoubleEliminationSeeder::class);

        $this->assertSame(1, Bracket::count());
        $bracket = Bracket::first();
        $this->assertSame('double_elimination', $bracket->format);
        $this->assertSame('draft', $bracket->status);
        $this->assertSame(9, $this->rows($bracket)->where('is_bye', false)->count());   // 2·5-1
        $this->assertSame(0, Event::count());
    }
}
