<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Settings → Standings: the college standings ranked Olympic-style, by the
 * standard points (Gold 10, Silver 7, Bronze 5), or by the office's own.
 *
 * The medals below: A has 2 golds (20 points); B has a gold, a silver and a
 * bronze (22); C has 2 silvers and a bronze (19); D a bronze (5).
 */
class StandingsRulesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->categories()->create(['name' => 'Cheerdance', 'format' => 'ranked']);
        foreach ([['A', 'B', 'C'], ['A', 'C', 'B'], ['B', 'C', 'D']] as $podium) {
            $event = $this->events()->create(['category' => 'Cheerdance']);
            foreach ($podium as $place => $college) {
                $this->scores()->create(['event_id' => $event->id, 'department' => $college, 'total_score' => 90 - $place * 10]);
            }
        }
    }

    private function board(): array
    {
        return collect($this->getJson('/api/leaderboard')->assertOk()->json())
            ->filter(fn ($r) => in_array($r['department'], ['A', 'B', 'C', 'D'], true))->values()->all();
    }

    public function test_by_default_colleges_are_ranked_by_points(): void
    {
        $board = $this->board();

        $this->assertSame(['B', 'A', 'C', 'D'], array_column($board, 'department'));
        $this->assertSame([22, 20, 19, 5], array_column($board, 'points'));
    }

    public function test_the_admin_can_switch_to_olympic_ranking_and_it_shows_at_once(): void
    {
        $this->board();   // cached under the old rules
        $this->actingAsRole('admin');

        $this->putJson('/api/admin/standings-rules', ['method' => 'olympic'])->assertOk()->assertJson(['method' => 'olympic']);

        $board = $this->board();
        $this->assertSame(['A', 'B', 'C', 'D'], array_column($board, 'department'));
        $this->assertSame([null, null, null, null], array_column($board, 'points'));
    }

    public function test_custom_points_rank_by_points_then_golds(): void
    {
        $this->actingAsRole('admin');
        $this->putJson('/api/admin/standings-rules', ['method' => 'custom', 'customPoints' => ['gold' => 3, 'silver' => 2, 'bronze' => 1]])
            ->assertOk()->assertJsonPath('points.gold', 3);

        $board = $this->board();
        // A and B both have 6: A has more golds.
        $this->assertSame(['A', 'B', 'C', 'D'], array_column($board, 'department'));
        $this->assertSame([6, 6, 5, 1], array_column($board, 'points'));

        // Switching away keeps the custom points for next time.
        $this->putJson('/api/admin/standings-rules', ['method' => 'points'])->assertOk()
            ->assertJsonPath('points.gold', 10)->assertJsonPath('customPoints.gold', 3);
    }

    public function test_custom_points_must_go_down_from_gold_to_bronze(): void
    {
        $this->actingAsRole('admin');

        $this->putJson('/api/admin/standings-rules', ['method' => 'custom', 'customPoints' => ['gold' => 5, 'silver' => 7, 'bronze' => 1]])
            ->assertStatus(422)->assertJsonValidationErrors('customPoints.silver');
        $this->putJson('/api/admin/standings-rules', ['method' => 'ranked-by-vibes'])->assertStatus(422);
    }

    public function test_only_an_admin_can_change_the_rules(): void
    {
        $this->actingAsRole('coach');
        $this->putJson('/api/admin/standings-rules', ['method' => 'olympic'])->assertForbidden();
        $this->getJson('/api/admin/standings-rules')->assertForbidden();
    }

    public function test_the_standings_export_follows_the_rules(): void
    {
        $this->actingAsRole('admin');
        $csv = $this->get('/api/reports/leaderboard/export?format=csv')->assertOk()->getContent();
        $this->assertStringContainsString('1,B,22,1,1,1', $csv);

        $this->putJson('/api/admin/standings-rules', ['method' => 'olympic'])->assertOk();
        $html = $this->get('/api/reports/leaderboard/export?format=html')->assertOk()->getContent();
        $this->assertStringNotContainsString('>Points</th>', $html);
        $this->assertStringContainsString('>Gold</th>', $html);
    }
}
