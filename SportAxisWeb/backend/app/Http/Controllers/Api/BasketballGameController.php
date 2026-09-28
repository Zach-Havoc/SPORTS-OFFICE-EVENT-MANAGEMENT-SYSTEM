<?php

namespace App\Http\Controllers\Api;

use App\Models\Event;
use App\Models\GameEvent;
use App\Models\GamePlayer;
use App\Models\LiveScore;
use App\Services\BasketballScoreboard;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Play-by-play basketball scoring, used by the mobile scorer. The score is
 * computed from the plays (game_events), never stored as a running total.
 *
 *   GET    /api/events/{id}/scoreboard       (public)
 *   POST   /api/events/{id}/plays            (scorekeeper)
 *   DELETE /api/events/{id}/plays/last       (scorekeeper — undo)
 *   PUT    /api/events/{id}/period           (scorekeeper)
 *   POST   /api/events/{id}/finish           (scorekeeper)
 *
 * The players come from each coach's lineup (GameLineupController); the
 * scorer only credits plays to them. Who may score, the row lock and the
 * live-board sync are shared with the other sports — see
 * PlayByPlayController.
 */
class BasketballGameController extends PlayByPlayController
{
    public function __construct(private BasketballScoreboard $scoreboard) {}

    /** GET /api/events/{id}/scoreboard */
    public function scoreboard(string $eventId)
    {
        return response()->json($this->scoreboard->build(Event::findOrFail($eventId)));
    }

    /**
     * GET /api/events/{id}/scoresheet — the recorded game, laid out for the
     * filled-in paper scoresheet (PDF). Only the game's committee or an
     * admin: it carries student numbers.
     */
    public function sheet(Request $request, string $eventId)
    {
        $event = Event::findOrFail($eventId);
        if (Gate::forUser($request->user())->denies('score-game', $event)) {
            return response()->json(['message' => 'Only this game\'s committee or an admin can open its scoresheet.'], 403);
        }

        return response()->json($this->scoreboard->sheet($event));
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
        return $this->undoLast($request, $eventId);
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
        }, after: fn (Event $event, LiveScore $live) => $this->closeGame($event, $live));
    }

    // ── Internals ─────────────────────────────────────────────────────

    protected function sport(): string
    {
        return 'basketball';
    }

    protected function board(Event $event, array $teams): array
    {
        return $this->scoreboard->build($event, $teams);
    }

    /** The live board shows the points and the quarter. */
    protected function headline(Event $event, array $teams, LiveScore $live): void
    {
        [$home, $away] = $this->scores($event, $teams);
        $period = (int) ($live->current_period ?: 1);

        $live->fill([
            'home_score' => $home,
            'away_score' => $away,
            'current_period' => $period,
            'period' => BasketballScoreboard::periodLabel($period),
        ]);
    }

    /** @return array{0: int, 1: int} [home, away] computed from the plays */
    private function scores(Event $event, array $teams): array
    {
        $totals = $this->scoreboard->totals($event->id);

        return [(int) ($totals[$teams[0]->id] ?? 0), (int) ($totals[$teams[1]->id] ?? 0)];
    }
}
