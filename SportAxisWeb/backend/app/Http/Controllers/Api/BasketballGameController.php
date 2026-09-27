<?php

namespace App\Http\Controllers\Api;

use App\Events\LiveScoreUpdated;
use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\GameEvent;
use App\Models\GamePlayer;
use App\Models\LiveScore;
use App\Services\BasketballScoreboard;
use App\Services\GameResultRecorder;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Play-by-play basketball scoring, used by the mobile scorer. The score is
 * computed from the plays (game_events), never stored as a running total.
 *
 *   GET    /api/events/{id}/scoreboard       (public)
 *   POST   /api/events/{id}/roster/sync      (scorekeeper — roster from athlete profiles)
 *   POST   /api/events/{id}/plays            (scorekeeper)
 *   DELETE /api/events/{id}/plays/last       (scorekeeper — undo)
 *   PUT    /api/events/{id}/period           (scorekeeper)
 *   POST   /api/events/{id}/finish           (scorekeeper)
 *
 * The scorekeeper is the committee member assigned to the game, or an admin
 * (the `score-game` gate). Every write runs in a transaction holding a row
 * lock on the event, so two scorekeepers tapping at once are serialised, and
 * re-syncs the headline score into `live_scores` so the live board and the
 * schedule keep working (and broadcasts it, as the manual scorer does).
 */
class BasketballGameController extends Controller
{
    public function __construct(private BasketballScoreboard $scoreboard) {}

    /** GET /api/events/{id}/scoreboard */
    public function scoreboard(string $eventId)
    {
        return response()->json($this->scoreboard->build(Event::findOrFail($eventId)));
    }

    /**
     * POST /api/events/{id}/roster/sync — rebuild both rosters from the
     * athletes' profiles (college, sport, active, jersey number). The scorer
     * calls it when the game opens. Returns the scoreboard plus notes on who
     * was left out and why.
     */
    public function syncRoster(Request $request, string $eventId)
    {
        $event = Event::findOrFail($eventId);
        $this->authorizeScorer($request, $event);
        $teams = $this->requireTeams($event);

        $live = LiveScore::where('event_id', $eventId)->first();
        $notes = [];
        if ($live?->status !== 'final') {
            $notes = DB::transaction(function () use ($eventId, $teams) {
                $event = Event::whereKey($eventId)->lockForUpdate()->firstOrFail();

                return $this->scoreboard->syncRoster($event, $teams);
            });
        }

        return response()->json([...$this->scoreboard->build($event, $teams), 'rosterNotes' => $notes]);
    }

    /** POST /api/events/{id}/plays  {teamId, type, playerId?} */
    public function store(Request $request, string $eventId)
    {
        $data = $request->validate([
            'teamId' => 'required|string',
            'type' => 'required|in:'.implode(',', GameEvent::TYPES),
            'playerId' => 'nullable|string|required_if:type,FOUL',
        ], [
            'playerId.required_if' => 'Pick a player first — a foul has to be charged to someone.',
        ]);

        return $this->write($request, $eventId, function (Event $event, array $teams, ?LiveScore $live) use ($data, $request) {
            $this->refuseIfFinished($live);
            $team = $this->teamById($teams, $data['teamId']);

            if (! empty($data['playerId'])) {
                $onRoster = GamePlayer::where('game_id', $event->id)->where('team_id', $team->id)
                    ->where('player_id', $data['playerId'])->exists();
                if (! $onRoster) {
                    $this->fail('That player isn\'t on this team\'s roster for this game.', ['playerId' => $data['playerId']]);
                }
            }

            GameEvent::create([
                'game_id' => $event->id,
                'team_id' => $team->id,
                'player_id' => $data['playerId'] ?? null,
                'type' => $data['type'],
                'period' => $live?->current_period ?? 1,
                'recorded_by' => $request->user()->id,
            ]);

            return $live;
        }, status: 201);
    }

    /** DELETE /api/events/{id}/plays/last */
    public function undo(Request $request, string $eventId)
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

    /** PUT /api/events/{id}/period  {period} — 1–4 regulation, 5+ overtime */
    public function setPeriod(Request $request, string $eventId)
    {
        $data = $request->validate(['period' => 'required|integer|min:1|max:20']);

        return $this->write($request, $eventId, function (Event $event, array $teams, ?LiveScore $live) use ($data) {
            $this->refuseIfFinished($live);

            $to = (int) $data['period'];
            $current = (int) ($live?->current_period ?? 1);
            $label = BasketballScoreboard::periodLabel($to);

            if ($to > $current + 1) {
                $this->fail('Periods go one at a time — next is '.BasketballScoreboard::periodLabel($current + 1).'.');
            }

            $latestPlayed = (int) GameEvent::where('game_id', $event->id)->max('period');
            if ($to < $latestPlayed) {
                $this->fail('Plays are already recorded in '.BasketballScoreboard::periodLabel($latestPlayed).'. Undo them before going back to '.$label.'.');
            }

            if ($to > $current && $to > BasketballScoreboard::regulationPeriods()) {
                [$home, $away] = $this->scores($event, $teams);
                if ($home !== $away) {
                    $this->fail("Overtime only follows a tie — it's {$home}–{$away}. Finish the game instead.");
                }
            }

            $live ??= $this->startLive($event);
            $live->current_period = $to;

            return $live;
        });
    }

    /** POST /api/events/{id}/finish */
    public function finish(Request $request, string $eventId)
    {
        return $this->write($request, $eventId, function (Event $event, array $teams, ?LiveScore $live) {
            $this->refuseIfFinished($live);

            [$home, $away] = $this->scores($event, $teams);
            if ($home === $away) {
                $next = BasketballScoreboard::periodLabel((int) ($live?->current_period ?? 1) + 1);
                $this->fail("The score is tied {$home}–{$away}. Start {$next} instead of finishing.");
            }

            $live ??= $this->startLive($event);
            $live->status = 'final';
            $live->finalized_at = now();

            return $live;
        }, after: function (Event $event, LiveScore $live) {
            if ($event->status !== 'completed') {
                $event->update(['status' => 'completed']);
            }
            // team_matches winner + standings cache + bracket advance.
            app(GameResultRecorder::class)->record($live, $event);
        });
    }

    // ── Internals ─────────────────────────────────────────────────────

    /**
     * Run one scorekeeper write: authorise, lock the event row, apply
     * `$change`, re-sync the live score from the plays, commit, broadcast,
     * and return the fresh scoreboard.
     *
     * `$change` may return the live score it modified (or null if the game
     * hasn't started — a first play starts it). `$after` runs inside the same
     * transaction once the live score is saved.
     */
    private function write(Request $request, string $eventId, callable $change, ?callable $after = null, int $status = 200)
    {
        $event = Event::findOrFail($eventId);
        $this->authorizeScorer($request, $event);

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

        return response()->json($this->scoreboard->build($event, $teams), $status);
    }

    /** Write the computed headline score into live_scores (the board's cache). */
    private function syncLive(Event $event, array $teams, ?LiveScore $live, string $userId): LiveScore
    {
        $live ??= $this->startLive($event);
        [$home, $away] = $this->scores($event, $teams);
        $period = (int) ($live->current_period ?: 1);

        $live->fill([
            'home_team' => $event->departments[0],
            'away_team' => $event->departments[1],
            'home_score' => $home,
            'away_score' => $away,
            'current_period' => $period,
            'period' => BasketballScoreboard::periodLabel($period),
            'updated_by' => $userId,
            'version' => (int) $live->version + 1,
        ]);
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

    private function startLive(Event $event): LiveScore
    {
        return LiveScore::firstOrNew(['event_id' => $event->id], [
            'id' => (string) Str::uuid(),
            'sport' => $event->category,
            'status' => 'in_progress',
            'current_period' => 1,
            'version' => 0,
        ]);
    }

    /** @return array{0: int, 1: int} [home, away] computed from the plays */
    private function scores(Event $event, array $teams): array
    {
        $totals = $this->scoreboard->totals($event->id);

        return [(int) ($totals[$teams[0]->id] ?? 0), (int) ($totals[$teams[1]->id] ?? 0)];
    }

    private function authorizeScorer(Request $request, Event $event): void
    {
        if (Gate::forUser($request->user())->denies('score-game', $event)) {
            $this->fail('You are not assigned to score this game.', status: 403);
        }
    }

    private function requireTeams(Event $event): array
    {
        return $this->scoreboard->teams($event)
            ?? $this->fail('This game needs exactly two colleges before it can be scored play-by-play.');
    }

    private function teamById(array $teams, string $teamId)
    {
        foreach ($teams as $team) {
            if ($team->id === $teamId) {
                return $team;
            }
        }
        $this->fail('That team isn\'t playing in this game.', ['teamId' => $teamId]);
    }

    private function refuseIfFinished(?LiveScore $live): void
    {
        if ($live?->status === 'final') {
            $this->fail('This game is finished — no more plays can be recorded.');
        }
    }

    /** Stop with a JSON error. Thrown, so an open transaction rolls back. */
    private function fail(string $message, array $extra = [], int $status = 422): never
    {
        throw new HttpResponseException(response()->json(['error' => $message, ...$extra], $status));
    }
}
