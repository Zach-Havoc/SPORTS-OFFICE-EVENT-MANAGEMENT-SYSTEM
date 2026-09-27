<?php

namespace App\Http\Controllers\Api;

use App\Events\LiveScoreUpdated;
use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\GameEvent;
use App\Models\LiveScore;
use App\Services\GameResultRecorder;
use App\Services\PlayByPlay;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * What every play-by-play sport's scorer shares. The score is computed from
 * the plays (game_events), never stored as a running total.
 *
 * The scorekeeper is the committee member assigned to the game, or an admin
 * (the `score-game` gate). Every write runs in a transaction holding a row
 * lock on the event, so two scorekeepers tapping at once are serialised, and
 * re-syncs the headline score into `live_scores` so the live board and the
 * schedule keep working (and broadcasts it, as the manual scorer does).
 *
 * A sport supplies its scoreboard (`board`) and what the live board shows
 * for it (`headline`).
 */
abstract class PlayByPlayController extends Controller
{
    /** The sport this controller scores — PlayByPlay::SPORTS. */
    abstract protected function sport(): string;

    /** The full scoreboard in API shape (camelCase — the mobile client reads it as-is). */
    abstract protected function board(Event $event, array $teams): array;

    /** Fill the live score's headline fields: home_score, away_score, period, current_period. */
    abstract protected function headline(Event $event, array $teams, LiveScore $live): void;

    /** DELETE …/plays/last — undo the latest play, whatever it was. */
    protected function undoLast(Request $request, string $eventId)
    {
        return $this->write($request, $eventId, function (Event $event, array $teams, ?LiveScore $live) {
            $this->refuseIfFinished($live);

            $last = GameEvent::where('game_id', $event->id)->orderByDesc('id')->first();
            if (! $last) {
                $this->fail('There\'s nothing to undo yet.');
            }
            $last->delete(); // soft — the audit trail keeps it

            return $live;
        });
    }

    /**
     * Run one scorekeeper write: authorise, lock the event row, apply
     * `$change`, re-sync the live score from the plays, commit, broadcast,
     * and return the fresh scoreboard.
     *
     * `$change` may return the live score it modified (or null if the game
     * hasn't started — a first play starts it). `$after` runs inside the same
     * transaction once the live score is saved.
     */
    protected function write(Request $request, string $eventId, callable $change, ?callable $after = null, int $status = 200)
    {
        $event = Event::findOrFail($eventId);
        $this->authorizeScorer($request, $event);
        if (PlayByPlay::sportOf($event) !== $this->sport()) {
            $this->fail("This game isn't scored as {$this->sport()}.");
        }

        [$event, $live, $teams] = DB::transaction(function () use ($request, $eventId, $change, $after) {
            $event = Event::whereKey($eventId)->lockForUpdate()->firstOrFail();
            $teams = $this->requireTeams($event);
            $live = LiveScore::where('event_id', $eventId)->first();

            $live = $change($event, $teams, $live) ?? $live;
            $live = $this->syncLive($event, $teams, $live, $request->user()->id);

            if ($after) {
                $after($event, $live);
            }

            return [$event, $live, $teams];
        });

        try {
            broadcast(new LiveScoreUpdated($live->toApiFormat($event)));
        } catch (\Throwable $e) {
            // Never let a socket-server hiccup break the scorer's write.
            Log::warning('Live score broadcast failed: '.$e->getMessage());
        }

        return response()->json($this->board($event, $teams), $status);
    }

    /** Close the game: live score final, event completed, result + bracket recorded. */
    protected function closeGame(Event $event, LiveScore $live): void
    {
        if ($event->status !== 'completed') {
            $event->update(['status' => 'completed']);
        }
        // team_matches winner + standings cache + bracket advance.
        app(GameResultRecorder::class)->record($live, $event);
    }

    /** Write the computed headline score into live_scores (the board's cache). */
    private function syncLive(Event $event, array $teams, ?LiveScore $live, string $userId): LiveScore
    {
        $live ??= $this->startLive($event);

        $live->fill([
            'home_team' => $event->departments[0],
            'away_team' => $event->departments[1],
            'updated_by' => $userId,
            'version' => (int) $live->version + 1,
        ]);
        $this->headline($event, $teams, $live);
        if ($live->status !== 'final') {
            $live->status = 'in_progress';
            $live->started_at ??= now();
        }
        $live->save();

        if ($live->status === 'in_progress' && $event->status === 'upcoming') {
            $event->update(['status' => 'ongoing']);
        }

        return $live;
    }

    protected function startLive(Event $event): LiveScore
    {
        return LiveScore::firstOrNew(['event_id' => $event->id], [
            'id' => (string) Str::uuid(),
            'sport' => $event->category,
            'status' => 'in_progress',
            'current_period' => 1,
            'version' => 0,
        ]);
    }

    protected function authorizeScorer(Request $request, Event $event): void
    {
        if (Gate::forUser($request->user())->denies('score-game', $event)) {
            $this->fail('You are not assigned to score this game.', status: 403);
        }
    }

    protected function requireTeams(Event $event): array
    {
        return PlayByPlay::teams($event)
            ?? $this->fail('This game needs exactly two colleges before it can be scored play-by-play.');
    }

    protected function teamById(array $teams, string $teamId)
    {
        foreach ($teams as $team) {
            if ($team->id === $teamId) {
                return $team;
            }
        }
        $this->fail('That team isn\'t playing in this game.', ['teamId' => $teamId]);
    }

    protected function refuseIfFinished(?LiveScore $live): void
    {
        if ($live?->status === 'final') {
            $this->fail('This game is finished — no more plays can be recorded.');
        }
    }

    /** Stop with a JSON error. Thrown, so an open transaction rolls back. */
    protected function fail(string $message, array $extra = [], int $status = 422): never
    {
        throw new HttpResponseException(response()->json(['error' => $message, ...$extra], $status));
    }
}
