<?php

namespace App\Http\Controllers\Api;

use App\Models\Event;
use App\Models\GameEvent;
use App\Models\GamePlayer;
use App\Models\LiveScore;
use App\Services\VolleyballMatch;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Play-by-play volleyball scoring, used by the mobile scorer. Everything is
 * computed by replaying the plays — see VolleyballMatch.
 *
 *   GET    /api/events/{id}/volleyball                (public)
 *   PUT    /api/events/{id}/volleyball/best-of        (scorekeeper — before set 1 starts)
 *   POST   /api/events/{id}/volleyball/sets           (scorekeeper — start the next set)
 *   POST   /api/events/{id}/volleyball/plays          (scorekeeper — a rally point or timeout)
 *   POST   /api/events/{id}/volleyball/subs           (scorekeeper — a substitution)
 *   DELETE /api/events/{id}/volleyball/plays/last     (scorekeeper — undo, even across sets)
 *   POST   /api/events/{id}/volleyball/finish         (scorekeeper — once the match is decided)
 *
 * The players are each coach's lineup for the game (GameLineupController),
 * which also carries the coach's default starting rotation. Who may score,
 * the row lock and the live-board sync are shared — see PlayByPlayController.
 */
class VolleyballGameController extends PlayByPlayController
{
    public function __construct(private VolleyballMatch $match) {}

    /** GET /api/events/{id}/volleyball */
    public function scoreboard(string $eventId)
    {
        return response()->json($this->match->build(Event::findOrFail($eventId)));
    }

    /** PUT /api/events/{id}/volleyball/best-of  {bestOf} */
    public function setBestOf(Request $request, string $eventId)
    {
        $data = $request->validate(['bestOf' => ['required', 'integer', Rule::in(VolleyballMatch::rules()['best_of'])]]);

        return $this->write($request, $eventId, function (Event $event, array $teams, ?LiveScore $live) use ($data) {
            $this->refuseIfFinished($live);
            if (GameEvent::where('game_id', $event->id)->exists()) {
                $this->fail('The match length can only change before the first set starts.');
            }
            $live ??= $this->startLive($event);
            $live->detail = [...($live->detail ?? []), 'bestOf' => (int) $data['bestOf']];

            return $live;
        });
    }

    /**
     * POST /api/events/{id}/volleyball/sets
     *   {firstServerTeamId, rotations?: {teamId: [6 playerIds in positions I–VI] | null}}
     *
     * A team's rotation defaults to its coach's starting rotation. Without
     * one, that team's serve is still tracked, just not which player serves.
     */
    public function startSet(Request $request, string $eventId)
    {
        $data = $request->validate([
            'firstServerTeamId' => 'required|string',
            'rotations' => 'sometimes|array',
            'rotations.*' => 'nullable|array|size:6',
            'rotations.*.*' => 'required|string|distinct',
        ], [
            'rotations.*.size' => 'A starting rotation has exactly six players, positions I to VI.',
            'rotations.*.*.distinct' => 'A player can only stand in one position.',
        ]);

        return $this->write($request, $eventId, function (Event $event, array $teams, ?LiveScore $live) use ($data, $request) {
            $this->refuseIfFinished($live);
            $s = $this->match->state($event, $teams, $live);
            if ($s['inProgress']) {
                $this->fail("Set {$this->setNo($s)} is still being played.");
            }
            if ($s['winner']) {
                $this->fail('The match is already decided — finish it instead.');
            }
            $server = $this->teamById($teams, $data['firstServerTeamId']);

            $roster = GamePlayer::where('game_id', $event->id)->get();
            $rotations = [];
            foreach ($teams as $team) {
                $given = array_key_exists($team->id, $data['rotations'] ?? [])
                    ? $data['rotations'][$team->id]
                    : VolleyballMatch::defaultRotation($roster, $team->id);
                if ($given) {
                    $mine = $roster->where('team_id', $team->id)->pluck('player_id');
                    if (collect($given)->diff($mine)->isNotEmpty()) {
                        $this->fail("{$team->name}'s rotation has a player who isn't in their lineup.");
                    }
                }
                $rotations[$team->id] = $given ? array_values($given) : null;
            }

            GameEvent::create([
                'game_id' => $event->id,
                'team_id' => $server->id,
                'type' => 'SET_START',
                'period' => count($s['sets']) + 1,
                'detail' => ['rotations' => $rotations],
                'recorded_by' => $request->user()->id,
            ]);

            return $live;
        }, status: 201);
    }

    /** POST /api/events/{id}/volleyball/plays  {teamId, type: KILL|ACE|BLOCK|OPP_ERROR|TIMEOUT, playerId?} */
    public function store(Request $request, string $eventId)
    {
        $data = $request->validate([
            'teamId' => 'required|string',
            'type' => ['required', Rule::in([...GameEvent::VOLLEYBALL_POINTS, 'TIMEOUT'])],
            'playerId' => 'nullable|string',
        ]);

        return $this->write($request, $eventId, function (Event $event, array $teams, ?LiveScore $live) use ($data, $request) {
            $this->refuseIfFinished($live);
            $team = $this->teamById($teams, $data['teamId']);
            $s = $this->requireSetInPlay($event, $teams, $live);
            $type = $data['type'];
            $playerId = $data['playerId'] ?? null;
            $rotation = $s['rotation'][$team->id];

            if ($type === 'TIMEOUT') {
                $used = $s['sets'][array_key_last($s['sets'])]['timeouts'][$team->id];
                if ($used >= VolleyballMatch::rules()['timeouts_per_set']) {
                    $this->fail("{$team->name} has no timeouts left this set.");
                }
                $playerId = null;
            }
            if ($type === 'OPP_ERROR' && $playerId) {
                $this->fail('An opponent\'s error is a point for this team, not for one of its players.');
            }
            if ($type === 'ACE') {
                if ($s['serving'] !== $team->id) {
                    $this->fail('Only the serving team can score an ace.');
                }
                // The server is known from the rotation: credit them.
                $playerId ??= $rotation[0] ?? null;
                if ($playerId && $rotation && $playerId !== $rotation[0]) {
                    $this->fail('An ace belongs to the server.');
                }
            }
            if ($playerId) {
                $this->requireOnTeam($event, $team, $playerId);
                if ($rotation && ! in_array($playerId, $rotation, true)) {
                    $this->fail('That player is on the bench — only players on court can score.');
                }
            }

            GameEvent::create([
                'game_id' => $event->id,
                'team_id' => $team->id,
                'player_id' => $playerId,
                'type' => $type,
                'period' => $this->setNo($s),
                'recorded_by' => $request->user()->id,
            ]);

            return $live;
        }, status: 201);
    }

    /** POST /api/events/{id}/volleyball/subs  {teamId, playerOutId, playerInId} */
    public function substitute(Request $request, string $eventId)
    {
        $data = $request->validate([
            'teamId' => 'required|string',
            'playerOutId' => 'required|string',
            'playerInId' => 'required|string|different:playerOutId',
        ]);

        return $this->write($request, $eventId, function (Event $event, array $teams, ?LiveScore $live) use ($data, $request) {
            $this->refuseIfFinished($live);
            $team = $this->teamById($teams, $data['teamId']);
            $s = $this->requireSetInPlay($event, $teams, $live);
            $rotation = $s['rotation'][$team->id];

            if (! $rotation) {
                $this->fail("{$team->name} started this set without a rotation, so substitutions can't be tracked.");
            }
            $used = $s['sets'][array_key_last($s['sets'])]['subs'][$team->id];
            if ($used >= VolleyballMatch::rules()['substitutions_per_set']) {
                $this->fail("{$team->name} has used all its substitutions this set.");
            }
            if (! in_array($data['playerOutId'], $rotation, true)) {
                $this->fail('The player coming off isn\'t on court.');
            }
            $this->requireOnTeam($event, $team, $data['playerInId']);
            if (in_array($data['playerInId'], $rotation, true)) {
                $this->fail('The player coming on is already on court.');
            }

            GameEvent::create([
                'game_id' => $event->id,
                'team_id' => $team->id,
                'player_id' => $data['playerInId'],
                'player_out_id' => $data['playerOutId'],
                'type' => 'SUB',
                'period' => $this->setNo($s),
                'recorded_by' => $request->user()->id,
            ]);

            return $live;
        }, status: 201);
    }

    /** DELETE /api/events/{id}/volleyball/plays/last */
    public function undo(Request $request, string $eventId)
    {
        return $this->undoLast($request, $eventId);
    }

    /** POST /api/events/{id}/volleyball/finish */
    public function finish(Request $request, string $eventId)
    {
        return $this->write($request, $eventId, function (Event $event, array $teams, ?LiveScore $live) {
            $this->refuseIfFinished($live);
            $s = $this->match->state($event, $teams, $live);
            if (! $s['winner']) {
                $need = VolleyballMatch::setsToWin($s['bestOf']);
                $this->fail("The match isn't decided yet — a team needs {$need} sets.");
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
        return 'volleyball';
    }

    protected function board(Event $event, array $teams): array
    {
        return $this->match->build($event, $teams);
    }

    /**
     * The live board shows sets won as the score, and the running set in
     * the period ("Set 2 · 18–15"); `detail` keeps every set's score.
     */
    protected function headline(Event $event, array $teams, LiveScore $live): void
    {
        $s = $this->match->state($event, $teams, $live);
        [$home, $away] = [$teams[0]->id, $teams[1]->id];
        $cur = array_key_last($s['sets']);
        $set = $cur === null ? null : $s['sets'][$cur];

        $live->fill([
            'home_score' => $s['setsWon'][$home],
            'away_score' => $s['setsWon'][$away],
            'current_period' => max(1, $cur === null ? 1 : $cur + 1),
            'period' => $set
                ? 'Set '.($cur + 1).' · '.$set['points'][$home].'–'.$set['points'][$away]
                : 'Set 1',
            'detail' => [
                ...($live->detail ?? []),
                'bestOf' => $s['bestOf'],
                'sets' => array_map(fn ($x) => [$x['points'][$home], $x['points'][$away]], $s['sets']),
            ],
        ]);
    }

    /** The replayed state, or a 422 if no set is being played right now. */
    private function requireSetInPlay(Event $event, array $teams, ?LiveScore $live): array
    {
        $s = $this->match->state($event, $teams, $live);
        if ($s['winner']) {
            $this->fail('The match is decided — finish it, or undo the last point.');
        }
        if (! $s['inProgress']) {
            $n = count($s['sets']) + 1;
            $this->fail("Start set {$n} first.");
        }

        return $s;
    }

    private function requireOnTeam(Event $event, $team, string $playerId): void
    {
        $ok = GamePlayer::where('game_id', $event->id)->where('team_id', $team->id)->where('player_id', $playerId)->exists();
        if (! $ok) {
            $this->fail('That player isn\'t in this team\'s lineup for this game.', ['playerId' => $playerId]);
        }
    }

    private function setNo(array $s): int
    {
        return max(1, count($s['sets']));
    }
}
