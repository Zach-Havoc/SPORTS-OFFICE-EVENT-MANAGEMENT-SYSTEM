<?php

namespace App\Services;

use App\Http\Controllers\Api\RankingController;
use App\Models\Event;
use App\Models\LiveScore;
use App\Models\TeamMatch;
use Illuminate\Support\Str;

/**
 * When a live game goes final, keep its `team_matches` row in sync so
 * standings and bracket seeding pick up the result, then advance the bracket.
 * Mirrors ScoreController::syncTeamMatch but driven by the explicit home/away
 * of the live score. Used by both the manual live score and play-by-play.
 */
class GameResultRecorder
{
    public function __construct(private BracketService $brackets) {}

    public function record(LiveScore $live, Event $event): ?TeamMatch
    {
        if (! $live->home_team || ! $live->away_team || $live->home_team === $live->away_team) {
            return null;
        }

        $match = TeamMatch::firstOrNew(['event_id' => $event->id]);
        if (! $match->exists) {
            $match->id = (string) Str::uuid();
        }

        $match->fill([
            'sport' => $event->category,
            'stage' => $match->stage ?: 'elimination',
            'home_team' => $live->home_team,
            'away_team' => $live->away_team,
            'home_score' => $live->home_score,
            'away_score' => $live->away_score,
            'status' => 'completed',
            'played_at' => $match->played_at ?? now(),
            'recorded_by' => $live->updated_by,
        ]);
        $match->resolveOutcome();
        $match->save();

        // Every write here can change this sport's round-robin standings
        // (bracketPodium()'s leaderboard input), not just events linked to a
        // bracket match — advanceFromEvent() below only forgets the cache
        // when it finds one to advance, so a standalone round-robin fixture
        // or a drawn game would otherwise leave a stale cached leaderboard.
        RankingController::forgetLeaderboardCacheFor($event->category, $event->season_id);

        // If this event is a bracket match, feed the winner into the next round.
        $this->brackets->advanceFromEvent($event->id);

        return $match;
    }
}
