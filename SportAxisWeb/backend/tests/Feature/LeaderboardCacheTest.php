<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\RankingController;
use App\Models\Score;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * GET /api/leaderboard is cached for a few minutes (recomputing it walks
 * every event's rankings plus a bracket-podium pass per sport). Any place
 * that changes a score or a bracket result must invalidate the matching
 * cache entry so a live update doesn't sit behind a stale board for the
 * full TTL.
 */
class LeaderboardCacheTest extends TestCase
{
    use RefreshDatabase;

    private function total(array $board, string $dept): mixed
    {
        return collect($board)->firstWhere('department', $dept)['total'] ?? null;
    }

    public function test_the_leaderboard_is_served_from_cache_on_the_next_request(): void
    {
        $this->categories()->create(['name' => 'Cheerdance', 'format' => 'ranked']);
        $event = $this->events()->create(['category' => 'Cheerdance']);
        $this->scores()->create(['event_id' => $event->id, 'department' => 'CET', 'total_score' => 95]);

        $first = $this->getJson('/api/leaderboard')->assertOk()->json();
        $this->assertEquals(95, $this->total($first, 'CET'));

        $this->assertTrue(Cache::has(RankingController::leaderboardCacheKey(null, null, null)));

        // Mutate the underlying score directly (bypassing every write path that
        // would invalidate the cache) — the next read should still be the
        // cached value, proving the endpoint isn't recomputing every request.
        Score::where('event_id', $event->id)->update(['total_score' => 10]);

        $stillCached = $this->getJson('/api/leaderboard')->assertOk()->json();
        $this->assertEquals(95, $this->total($stillCached, 'CET'));
    }

    public function test_submitting_a_score_invalidates_the_cached_leaderboard(): void
    {
        $this->categories()->create(['name' => 'Cheerdance', 'format' => 'ranked']);
        $event = $this->events()->create(['category' => 'Cheerdance']);
        $judge = $this->actingAsRole('judge');
        // Same judge_id as the resubmission below, so the update replaces this
        // row instead of averaging in as a second judge's score.
        $this->scores()->create(['event_id' => $event->id, 'department' => 'CET', 'total_score' => 95, 'judge_id' => $judge->id]);

        $this->getJson('/api/leaderboard')->assertOk();
        $this->assertTrue(Cache::has(RankingController::leaderboardCacheKey(null, null, null)));

        $this->postJson('/api/scores', [
            'eventId' => $event->id,
            'department' => 'CET',
            'totalScore' => 50,
        ])->assertCreated();

        // The write path forgot the cache; the very next read must be fresh.
        $this->assertFalse(Cache::has(RankingController::leaderboardCacheKey(null, null, null)));

        $updated = $this->getJson('/api/leaderboard')->assertOk()->json();
        $this->assertEquals(50, $this->total($updated, 'CET'));
    }
}
