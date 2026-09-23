<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\RankingController;
use App\Models\Bracket;
use App\Models\BracketMatch;
use App\Models\TeamMatch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * RankingController::leaderboard() is cached (see LeaderboardCacheTest) and
 * invalidated from ScoreController::recalculateRankings() and
 * BracketService::resolve(). Round-robin podiums, however, are driven by
 * `team_matches` directly (TeamMatch::standings()) — and that table is also
 * written by two paths that never call RankingController::forgetLeaderboardCacheFor():
 *
 *   - MatchController::store()/update()/destroy() — raw admin CRUD on
 *     `team_matches`, with no call into BracketService or the ranking cache
 *     at all.
 *   - LiveScoreController::recordHeadToHead() — only reaches
 *     BracketService::resolve() (and therefore the cache-forget) via
 *     advanceFromEvent(), which no-ops whenever the finished game isn't
 *     linked to a BracketMatch (e.g. a standalone round-robin fixture, or a
 *     drawn game) even though the `team_matches` row it just wrote already
 *     changed the standings.
 *
 * Either path lets an admin/committee change a round-robin department's
 * medal position while the previously cached leaderboard keeps serving the
 * old podium for up to CACHE_TTL_SECONDS.
 */
class LeaderboardCacheGapsTest extends TestCase
{
    use RefreshDatabase;

    private function total(array $board, string $dept): mixed
    {
        return collect($board)->firstWhere('department', $dept)['total'] ?? null;
    }

    private function row(array $board, string $dept): ?array
    {
        return collect($board)->firstWhere('department', $dept);
    }

    private function makeCompletedRoundRobinBracket(): Bracket
    {
        $bracket = Bracket::create([
            'id' => 'brk-rr-1',
            'sport' => 'Basketball',
            'format' => 'round_robin',
            'name' => 'RR Test',
            'status' => 'active',
        ]);

        BracketMatch::create([
            'id' => 'bm-rr-1',
            'bracket_id' => $bracket->id,
            'round' => 1,
            'slot' => 0,
            'stage_label' => 'Round Robin',
            'home_team' => 'CICS',
            'away_team' => 'CET',
            'winner' => 'CICS',
            'loser' => 'CET',
            'is_bye' => false,
            'status' => 'completed',
        ]);

        TeamMatch::create([
            'id' => 'tm-rr-1',
            'sport' => 'Basketball',
            'stage' => 'round_robin',
            'home_team' => 'CICS',
            'away_team' => 'CET',
            'home_score' => 80,
            'away_score' => 60,
            'winner' => 'CICS',
            'is_draw' => false,
            'status' => 'completed',
            'played_at' => now(),
        ]);

        return $bracket->fresh('matches');
    }

    public function test_admin_recording_a_round_robin_match_invalidates_the_cached_leaderboard(): void
    {
        $this->makeCompletedRoundRobinBracket();
        $this->actingAsRole('admin');

        $before = $this->getJson('/api/leaderboard')->assertOk()->json();
        $this->assertSame(1, $this->row($before, 'CICS')['gold'] ?? null);
        $this->assertTrue(Cache::has(RankingController::leaderboardCacheKey(null, null, null)));

        // A second round-robin result that would flip the standings (CAS now
        // has the better record than CICS), recorded through the admin
        // matches endpoint — NOT through ScoreController or BracketService.
        $this->postJson('/api/matches', [
            'sport' => 'Basketball',
            'stage' => 'round_robin',
            'homeTeam' => 'CAS',
            'awayTeam' => 'CICS',
            'homeScore' => 99,
            'awayScore' => 10,
            'status' => 'completed',
        ])->assertCreated();

        // The write path should have forgotten the cache; it currently doesn't.
        $this->assertFalse(
            Cache::has(RankingController::leaderboardCacheKey(null, null, null)),
            'POST /api/matches changed team_matches (and therefore round-robin standings) '.
            'but left the cached /api/leaderboard response in place — MatchController never '.
            'calls RankingController::forgetLeaderboardCacheFor().'
        );
    }

    public function test_deleting_a_round_robin_match_invalidates_the_cached_leaderboard(): void
    {
        $this->makeCompletedRoundRobinBracket();
        $this->actingAsRole('admin');

        $this->getJson('/api/leaderboard')->assertOk();
        $this->assertTrue(Cache::has(RankingController::leaderboardCacheKey(null, null, null)));

        $this->deleteJson('/api/matches/tm-rr-1')->assertOk();

        $this->assertFalse(
            Cache::has(RankingController::leaderboardCacheKey(null, null, null)),
            'DELETE /api/matches/{id} removed a team_matches row feeding round-robin '.
            'standings but left the cached /api/leaderboard response in place.'
        );
    }
}
