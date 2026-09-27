<?php

namespace App\Http\Controllers\Api;

use App\Events\LiveScoreUpdated;
use App\Events\ScoreboardUpdated;
use App\Http\Controllers\Controller;
use App\Models\Athlete;
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
 * Play-by-play basketball scoring. The score is computed from the plays
 * (game_events), never stored as a running total.
 *
 *   GET    /api/events/{id}/scoreboard               (public)
 *   GET    /api/events/{id}/roster                   (scorekeeper)
 *   PUT    /api/events/{id}/roster                   (scorekeeper — one team's roster)
 *   POST   /api/events/{id}/plays                    (scorekeeper)
 *   DELETE /api/events/{id}/plays/last               (scorekeeper — undo)
 *   PATCH  /api/events/{id}/plays/{play}/player      (scorekeeper)
 *   PUT    /api/events/{id}/period                   (scorekeeper)
 *   POST   /api/events/{id}/finish                   (scorekeeper)
 *
 * The scorekeeper is the committee member assigned to the game, or an admin
 * (the `score-game` gate). Every write runs in a transaction holding a row
 * lock on the event, so two scorekeepers tapping at once are serialised, and
 * re-syncs the headline score into `live_scores` so the live board and the
 * schedule keep working. After commit it broadcasts the full scoreboard on
 * `live-scores.{id}` and the headline live score on the existing channels.
 */
class BasketballGameController extends Controller
{
    public function __construct(private BasketballScoreboard $scoreboard) {}

    /** GET /api/events/{id}/scoreboard */
    public function scoreboard(string $eventId)
    {
        return response()->json($this->scoreboard->build(Event::findOrFail($eventId)));
    }

    /** GET /api/events/{id}/roster — each team's game roster plus the athletes who could be added. */
    public function roster(Request $request, string $eventId)
    {
        $event = Event::findOrFail($eventId);
        $this->authorizeScorer($request, $event);
        $teams = $this->requireTeams($event);

        $roster = GamePlayer::with('athlete')->where('game_id', $eventId)->get();

        return response()->json([
            'teams' => array_map(function ($team) use ($event, $roster) {
                $name = fn (?Athlete $a) => $a ? trim($a->first_name.' '.$a->last_name) : 'Unknown player';

                return [
                    'id' => $team->id,
                    'name' => $team->name,
                    'players' => $roster->where('team_id', $team->id)->map(fn (GamePlayer $gp) => [
                        'playerId' => $gp->player_id,
                        'jerseyNumber' => $gp->jersey_number,
                        'isStarter' => $gp->is_starter,
                        'name' => $name($gp->athlete),
                    ])->values()->all(),
                    'candidates' => $this->collegeAthletes($team)
                        ->where('status', 'active')
                        ->where(fn ($q) => $q
                            ->when($event->category_id, fn ($q) => $q->where('category_id', $event->category_id))
                            ->orWhereRaw('LOWER(?) LIKE CONCAT(LOWER(sport), \'%\')', [$event->category]))
                        ->orderBy('last_name')
                        ->get()
                        ->map(fn (Athlete $a) => [
                            'playerId' => $a->id,
                            'name' => $name($a),
                            'studentId' => $a->student_id,
                        ])->all(),
                ];
            }, $teams),
        ]);
    }

    /** PUT /api/events/{id}/roster  {teamId, players: [{playerId, jerseyNumber, isStarter}]} */
    public function updateRoster(Request $request, string $eventId)
    {
        $data = $request->validate([
            'teamId' => 'required|string',
            'players' => 'present|array|max:30',
            'players.*.playerId' => 'required|string|distinct',
            'players.*.jerseyNumber' => ['required', 'string', 'regex:/^\d{1,2}$/', 'distinct'],
            'players.*.isStarter' => 'sometimes|boolean',
        ], [
            'players.*.jerseyNumber.regex' => 'Jersey numbers are 0–99 (00 allowed).',
            'players.*.jerseyNumber.distinct' => 'Two players can\'t wear the same jersey number.',
        ]);

        return $this->write($request, $eventId, function (Event $event, array $teams, ?LiveScore $live) use ($data) {
            $this->refuseIfFinished($live);
            $team = $this->teamById($teams, $data['teamId']);

            $ids = collect($data['players'])->pluck('playerId');
            $valid = $this->collegeAthletes($team)->whereIn('id', $ids)->pluck('id');
            if ($missing = $ids->diff($valid)->first()) {
                $this->fail("That athlete isn't from {$team->name}.", ['playerId' => $missing]);
            }

            $elsewhere = GamePlayer::where('game_id', $event->id)->where('team_id', '!=', $team->id)
                ->whereIn('player_id', $ids)->exists();
            if ($elsewhere) {
                $this->fail('A player can only be on one team in a game.');
            }

            // Don't drop a player whose plays are already on the board.
            $dropping = GamePlayer::where('game_id', $event->id)->where('team_id', $team->id)
                ->whereNotIn('player_id', $ids)->pluck('player_id');
            if ($dropping->isNotEmpty() && GameEvent::where('game_id', $event->id)->whereIn('player_id', $dropping)->exists()) {
                $this->fail('A player who already has plays in this game can\'t be removed from the roster. Reassign or undo their plays first.');
            }

            GamePlayer::where('game_id', $event->id)->where('team_id', $team->id)->delete();
            foreach ($data['players'] as $p) {
                GamePlayer::create([
                    'game_id' => $event->id,
                    'team_id' => $team->id,
                    'player_id' => $p['playerId'],
                    'jersey_number' => $p['jerseyNumber'],
                    'is_starter' => (bool) ($p['isStarter'] ?? false),
                ]);
            }

            return $live;
        });
    }

    /** POST /api/events/{id}/plays  {teamId, type, playerId?, gameClock?} */
    public function store(Request $request, string $eventId)
    {
        $data = $request->validate([
            'teamId' => 'required|string',
            'type' => 'required|in:'.implode(',', GameEvent::TYPES),
            'playerId' => 'nullable|string|required_if:type,FOUL',
            'gameClock' => ['nullable', 'string', 'regex:/^\d{1,2}:\d{2}(\.\d)?$/'],
        ], [
            'playerId.required_if' => 'Pick a player first — a foul has to be charged to someone.',
            'gameClock.regex' => 'Game clock is minutes:seconds, like 7:42.',
        ]);

        return $this->write($request, $eventId, function (Event $event, array $teams, ?LiveScore $live) use ($data, $request) {
            $this->refuseIfFinished($live);
            $team = $this->teamById($teams, $data['teamId']);

            if (! empty($data['playerId'])) {
                $gp = $this->rosterEntry($event->id, $team->id, $data['playerId']);
                $this->refuseIfFouledOut($event->id, $gp);
            }

            GameEvent::create([
                'game_id' => $event->id,
                'team_id' => $team->id,
                'player_id' => $data['playerId'] ?? null,
                'type' => $data['type'],
                'period' => $live?->current_period ?? 1,
                'game_clock' => $data['gameClock'] ?? null,
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

    /**
     * PATCH /api/events/{id}/plays/{play}/player  {playerId|null}
     *
     * Allowed after the game is finished — it changes who scored, not the score.
     */
    public function assignPlayer(Request $request, string $eventId, string $playId)
    {
        $data = $request->validate(['playerId' => 'present|nullable|string']);

        return $this->write($request, $eventId, function (Event $event, array $teams, ?LiveScore $live) use ($data, $playId) {
            $play = GameEvent::where('game_id', $event->id)->find($playId);
            if (! $play) {
                $this->fail('That play isn\'t in this game (it may have been undone).', status: 404);
            }

            if (empty($data['playerId'])) {
                if ($play->isFoul()) {
                    $this->fail('A foul has to be charged to a player.');
                }
                $play->update(['player_id' => null]);

                return $live;
            }

            $gp = $this->rosterEntry($event->id, $play->team_id, $data['playerId']);
            $this->refuseIfFouledOut($event->id, $gp, $play);
            $play->update(['player_id' => $gp->player_id]);

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

        [$event, $live] = DB::transaction(function () use ($request, $eventId, $change, $after) {
            $event = Event::whereKey($eventId)->lockForUpdate()->firstOrFail();
            $teams = $this->requireTeams($event);
            $live = LiveScore::where('event_id', $eventId)->first();

            $live = $change($event, $teams, $live) ?? $live;
            $live = $this->syncLive($event, $teams, $live, $request->user()->id);

            if ($after) {
                $after($event, $live);
            }

            return [$event, $live];
        });

        $scoreboard = $this->scoreboard->build($event);
        $this->push(fn () => new ScoreboardUpdated($scoreboard));
        $this->push(fn () => new LiveScoreUpdated($live->toApiFormat($event)));

        return response()->json($scoreboard, $status);
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

    /** The player must be on that team's roster for THIS game. */
    private function rosterEntry(string $eventId, string $teamId, string $playerId): GamePlayer
    {
        $gp = GamePlayer::with('athlete')->where('game_id', $eventId)
            ->where('team_id', $teamId)->where('player_id', $playerId)->first();

        return $gp ?? $this->fail('That player isn\'t on this team\'s roster for this game.', ['playerId' => $playerId]);
    }

    /**
     * Reject a play for a player who has reached the foul-out limit. When
     * re-attributing an existing `$play`, only fouls committed before it
     * count, so a basket from before they fouled out can still be credited.
     */
    private function refuseIfFouledOut(string $eventId, GamePlayer $gp, ?GameEvent $play = null): void
    {
        $limit = BasketballScoreboard::foulOutLimit();
        $fouls = GameEvent::where('game_id', $eventId)->where('player_id', $gp->player_id)->where('type', 'FOUL')
            ->when($play, fn ($q) => $q->whereKeyNot($play->id)->when(! $play->isFoul(), fn ($q) => $q->where('id', '<', $play->id)))
            ->count();

        if ($fouls >= $limit) {
            $name = $gp->athlete ? trim($gp->athlete->first_name.' '.$gp->athlete->last_name) : 'This player';
            $this->fail("#{$gp->jersey_number} {$name} has fouled out ({$fouls} fouls).", ['playerId' => $gp->player_id]);
        }
    }

    private function refuseIfFinished(?LiveScore $live): void
    {
        if ($live?->status === 'final') {
            $this->fail('This game is finished — no more plays can be recorded.');
        }
    }

    /**
     * Stop with a JSON error. Thrown, so an open transaction rolls back.
     * `{error}` is what the web client's apiRequest surfaces.
     */
    private function fail(string $message, array $extra = [], int $status = 422): never
    {
        throw new HttpResponseException(response()->json(['error' => $message, ...$extra], $status));
    }

    /** Query for a college's athletes (department stored as name or abbreviation). */
    private function collegeAthletes($team)
    {
        $keys = array_values(array_filter([mb_strtolower($team->name), mb_strtolower((string) $team->abbreviation)]));

        return Athlete::query()->whereIn(DB::raw('LOWER(department)'), $keys);
    }

    /** Broadcast, but never let a socket-server hiccup break the scorer's write. */
    private function push(callable $makeEvent): void
    {
        try {
            broadcast($makeEvent());
        } catch (\Throwable $e) {
            Log::warning('Scoreboard broadcast failed: '.$e->getMessage());
        }
    }
}
