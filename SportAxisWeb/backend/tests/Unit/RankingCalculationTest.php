<?php

namespace Tests\Unit;

use App\Http\Controllers\Api\ScoreController;
use App\Models\Ranking;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * ScoreController::recalculateRankings() — the pure ranking maths.
 *
 * A department's score is the AVERAGE of its judges' total scores; departments
 * are then ordered highest-first and numbered 1..n. Removing all scores clears
 * the rankings.
 */
class RankingCalculationTest extends TestCase
{
    use RefreshDatabase;

    public function test_department_score_is_the_average_of_its_judges(): void
    {
        $event = $this->events()->create();

        // Team A: two judges (80 and 90 => average 85). Team B: one judge (70).
        $this->scores()->create(['event_id' => $event->id, 'department' => 'Team A', 'judge_id' => 'j1', 'total_score' => 80]);
        $this->scores()->create(['event_id' => $event->id, 'department' => 'Team A', 'judge_id' => 'j2', 'total_score' => 90]);
        $this->scores()->create(['event_id' => $event->id, 'department' => 'Team B', 'judge_id' => 'j3', 'total_score' => 70]);

        ScoreController::recalculateRankings($event->id);

        $a = Ranking::where('event_id', $event->id)->where('department', 'Team A')->first();
        $b = Ranking::where('event_id', $event->id)->where('department', 'Team B')->first();

        $this->assertEquals(85, (float) $a->total_score);
        $this->assertSame(2, $a->judge_count);
        $this->assertSame(1, $a->rank);

        $this->assertEquals(70, (float) $b->total_score);
        $this->assertSame(1, $b->judge_count);
        $this->assertSame(2, $b->rank);
    }

    public function test_recalculation_replaces_previous_rankings(): void
    {
        $event = $this->events()->create();
        Ranking::create(['event_id' => $event->id, 'department' => 'Stale', 'total_score' => 999, 'judge_count' => 1, 'rank' => 1]);

        $this->scores()->create(['event_id' => $event->id, 'department' => 'Fresh', 'total_score' => 50]);

        ScoreController::recalculateRankings($event->id);

        $this->assertDatabaseMissing('rankings', ['department' => 'Stale']);
        $this->assertDatabaseHas('rankings', ['department' => 'Fresh', 'rank' => 1]);
    }

    public function test_no_scores_clears_the_rankings(): void
    {
        $event = $this->events()->create();
        Ranking::create(['event_id' => $event->id, 'department' => 'Team A', 'total_score' => 10, 'judge_count' => 1, 'rank' => 1]);

        ScoreController::recalculateRankings($event->id);

        $this->assertSame(0, Ranking::where('event_id', $event->id)->count());
    }

    public function test_tied_departments_still_get_sequential_ranks(): void
    {
        $event = $this->events()->create();
        $this->scores()->create(['event_id' => $event->id, 'department' => 'Team A', 'total_score' => 75]);
        $this->scores()->create(['event_id' => $event->id, 'department' => 'Team B', 'total_score' => 75]);

        ScoreController::recalculateRankings($event->id);

        $ranks = Ranking::where('event_id', $event->id)->orderBy('rank')->pluck('rank')->all();
        $this->assertSame([1, 2], $ranks);
    }
}
