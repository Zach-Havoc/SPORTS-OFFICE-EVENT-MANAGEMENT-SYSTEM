<?php

namespace Tests\Feature;

use App\Models\TeamMatch;
use App\Services\BracketService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * QA verification pass for the BracketService::generate() draw-method fix.
 * Independent of the developer's tests in BracketTest.php: checks the FULL
 * round-1 slot layout (not just slot 0) matches between 'random' and
 * 'manual' given an identical submitted order, and that an explicit
 * drawMethod:'standings' string (not just the seedFromStandings alias)
 * still reorders.
 */
class BracketDrawMethodVerificationTest extends TestCase
{
    use RefreshDatabase;

    private function service(): BracketService
    {
        return app(BracketService::class);
    }

    private function config(array $overrides = []): array
    {
        return array_merge([
            'sport' => 'Basketball',
            'format' => 'single_elimination',
            'participants' => ['A', 'B', 'C', 'D'],
            'startDate' => '2026-10-01',
            'startTime' => '09:00',
            'matchDuration' => 60,
            'breakDuration' => 15,
        ], $overrides);
    }

    public function test_random_and_manual_produce_identical_full_round1_layout_for_a_larger_field(): void
    {
        $order = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

        $manual = $this->service()->generate($this->config([
            'drawMethod' => 'manual',
            'participants' => $order,
        ]));
        $random = $this->service()->generate($this->config([
            'drawMethod' => 'random',
            'participants' => $order,
        ]));

        $layout = fn ($b) => $b->matches->where('round', 1)->sortBy('slot')
            ->map(fn ($m) => [$m->home_team, $m->away_team])->values()->all();

        $this->assertSame($layout($manual), $layout($random));

        // Sanity: this is genuinely the serpentine seeding of the *submitted*
        // order, not some other deterministic-but-wrong pairing.
        $slot0 = $random->matches->firstWhere(fn ($m) => $m->round === 1 && $m->slot === 0);
        $this->assertSame('A', $slot0->home_team);
        $this->assertSame('H', $slot0->away_team);
    }

    public function test_explicit_drawmethod_standings_string_still_reorders_not_just_the_seedfromstandings_alias(): void
    {
        TeamMatch::query()->insert([
            ['id' => 'm1', 'sport' => 'Basketball', 'stage' => 'round_robin', 'home_team' => 'CICS', 'away_team' => 'CABEIHM', 'home_score' => 80, 'away_score' => 60, 'winner' => 'CICS', 'is_draw' => 0, 'status' => 'completed', 'created_at' => now(), 'updated_at' => now()],
        ]);

        $bracket = $this->service()->generate($this->config([
            'drawMethod' => 'standings',
            'participants' => ['CABEIHM', 'CICS'],
        ]));

        $this->assertTrue($bracket->seeded);
        $slot0 = $bracket->matches->firstWhere(fn ($m) => $m->round === 1 && $m->slot === 0);
        // CICS has the winning record, so it should be seed 1 (home), even
        // though it was submitted second in the participants array — proving
        // this branch actually reorders rather than trusting submission order.
        $this->assertSame('CICS', $slot0->home_team);
        $this->assertSame('CABEIHM', $slot0->away_team);
    }
}
