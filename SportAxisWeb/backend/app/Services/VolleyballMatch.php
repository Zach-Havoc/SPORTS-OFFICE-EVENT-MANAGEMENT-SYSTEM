<?php

namespace App\Services;

use App\Models\Event;
use App\Models\GameEvent;
use App\Models\GamePlayer;
use App\Models\LiveScore;
use Illuminate\Support\Collection;

/**
 * A volleyball match, computed by replaying its plays (game_events) in
 * order. Nothing but the plays is stored — sets, the score, who serves, the
 * rotations, timeouts and substitutions all fall out of the replay, so undoing
 * the last play (even one that ended a set) is always consistent.
 *
 * Plays:
 *   SET_START   team_id serves first; detail.rotations = {teamId: [6 ids]|null}
 *               (positions I–VI; I serves)
 *   KILL, ACE, BLOCK, OPP_ERROR
 *               a rally won by team_id (player_id optional; never on OPP_ERROR)
 *   TIMEOUT     team_id
 *   SUB         team_id; player_out_id leaves, player_id takes their position
 *
 * Rally scoring: the rally winner scores and serves next. A team winning the
 * serve back (a side-out) rotates clockwise first — position II moves to I.
 * A set is won at `set_points` (the deciding set: `deciding_set_points`) with
 * a 2-point lead.
 */
class VolleyballMatch
{
    public static function rules(): array
    {
        return config('sportaxis.volleyball');
    }

    /** The match length the committee picked, stored with the live score. */
    public static function bestOf(?LiveScore $live): int
    {
        $b = (int) ($live?->detail['bestOf'] ?? 0);

        return in_array($b, self::rules()['best_of'], true) ? $b : (int) self::rules()['default_best_of'];
    }

    public static function setsToWin(int $bestOf): int
    {
        return intdiv($bestOf, 2) + 1;
    }

    /** Points needed to win set `$n` of a best-of-`$bestOf` match. */
    public static function target(int $n, int $bestOf): int
    {
        return $n === $bestOf ? (int) self::rules()['deciding_set_points'] : (int) self::rules()['set_points'];
    }

    /**
     * Replay the plays into the match state.
     *
     * @param  array{0: object, 1: object}  $teams  [home, away] departments
     */
    public function replay(Collection $plays, array $teams, int $bestOf): array
    {
        [$home, $away] = [$teams[0]->id, $teams[1]->id];
        $zero = [$home => 0, $away => 0];

        $s = [
            'bestOf' => $bestOf,
            'sets' => [],
            'setsWon' => $zero,
            'serving' => null,
            'rotation' => [$home => null, $away => null],
            'inProgress' => false,
            'winner' => null,
            'stats' => [],
            'oppErrors' => $zero,
            'log' => [],
        ];

        foreach ($plays as $p) {
            $cur = array_key_last($s['sets']);

            if ($p->type === 'SET_START') {
                $rot = (array) ($p->detail['rotations'] ?? []);
                $s['sets'][] = [
                    'number' => count($s['sets']) + 1,
                    'points' => $zero,
                    'winner' => null,
                    'firstServer' => $p->team_id,
                    'timeouts' => $zero,
                    'subs' => $zero,
                ];
                $s['rotation'] = [$home => $rot[$home] ?? null, $away => $rot[$away] ?? null];
                $s['serving'] = $p->team_id;
                $s['inProgress'] = true;
            } elseif (in_array($p->type, GameEvent::VOLLEYBALL_POINTS, true) && $s['inProgress']) {
                $team = $p->team_id;
                if ($s['serving'] !== $team && $s['rotation'][$team]) {
                    $r = $s['rotation'][$team];
                    $s['rotation'][$team] = [...array_slice($r, 1), $r[0]]; // side-out: II → I
                }
                $s['serving'] = $team;
                $s['sets'][$cur]['points'][$team]++;

                if ($p->type === 'OPP_ERROR') {
                    $s['oppErrors'][$team]++;
                } elseif ($p->player_id) {
                    $key = ['KILL' => 'kills', 'ACE' => 'aces', 'BLOCK' => 'blocks'][$p->type];
                    $s['stats'][$p->player_id][$key] = ($s['stats'][$p->player_id][$key] ?? 0) + 1;
                }

                $pts = $s['sets'][$cur]['points'];
                $other = $team === $home ? $away : $home;
                if ($pts[$team] >= self::target($cur + 1, $bestOf) && self::rules()['win_by'] <= $pts[$team] - $pts[$other]) {
                    $s['sets'][$cur]['winner'] = $team;
                    $s['setsWon'][$team]++;
                    $s['inProgress'] = false;
                    $s['serving'] = null;
                    if ($s['setsWon'][$team] >= self::setsToWin($bestOf)) {
                        $s['winner'] = $team;
                    }
                }
            } elseif ($p->type === 'TIMEOUT' && $s['inProgress']) {
                $s['sets'][$cur]['timeouts'][$p->team_id]++;
            } elseif ($p->type === 'SUB' && $s['inProgress']) {
                $s['sets'][$cur]['subs'][$p->team_id]++;
                $r = $s['rotation'][$p->team_id];
                if ($r && ($i = array_search($p->player_out_id, $r, true)) !== false) {
                    $r[$i] = $p->player_id;
                    $s['rotation'][$p->team_id] = $r;
                }
            }

            $last = array_key_last($s['sets']);
            $s['log'][$p->id] = [
                'set' => $last === null ? 0 : $last + 1,
                'home' => $last === null ? 0 : $s['sets'][$last]['points'][$home],
                'away' => $last === null ? 0 : $s['sets'][$last]['points'][$away],
            ];
        }

        return $s;
    }

    /** Load and replay a game's plays. */
    public function state(Event $event, array $teams, ?LiveScore $live = null): array
    {
        $live ??= LiveScore::where('event_id', $event->id)->first();
        $plays = GameEvent::where('game_id', $event->id)->orderBy('id')->get();

        return [...$this->replay($plays, $teams, self::bestOf($live)), 'plays' => $plays];
    }

    /** The coach's default starting rotation for a team: 6 ids in positions I–VI, or null. */
    public static function defaultRotation(Collection $roster, string $teamId): ?array
    {
        $set = $roster->where('team_id', $teamId)->whereNotNull('rotation_position')->sortBy('rotation_position');
        if ($set->count() !== 6 || $set->pluck('rotation_position')->values()->all() !== [1, 2, 3, 4, 5, 6]) {
            return null;
        }

        return $set->pluck('player_id')->values()->all();
    }

    /** The full scoreboard in API shape (camelCase — the mobile client reads it as-is). */
    public function build(Event $event, ?array $teams = null): array
    {
        $teams ??= PlayByPlay::teams($event);
        $live = LiveScore::where('event_id', $event->id)->first();
        $bestOf = self::bestOf($live);

        $base = [
            'sport' => 'volleyball',
            'eventId' => $event->id,
            'eventName' => $event->name,
            'category' => $event->category,
            'version' => (int) ($live?->version ?? 0),
            'ready' => $teams !== null,
            'bestOf' => $bestOf,
            'setsToWin' => self::setsToWin($bestOf),
            'rules' => [
                'setPoints' => (int) self::rules()['set_points'],
                'decidingSetPoints' => (int) self::rules()['deciding_set_points'],
                'timeoutsPerSet' => (int) self::rules()['timeouts_per_set'],
                'substitutionsPerSet' => (int) self::rules()['substitutions_per_set'],
                'bestOfOptions' => self::rules()['best_of'],
            ],
            'updatedAt' => $live?->updated_at,
        ];
        if (! $teams) {
            return [...$base, 'status' => 'scheduled', 'teams' => [], 'sets' => [], 'log' => []];
        }

        $s = $this->state($event, $teams, $live);
        $roster = GamePlayer::with('athlete.account')->where('game_id', $event->id)->get()
            ->sortBy(fn (GamePlayer $p) => [(int) $p->jersey_number, strlen($p->jersey_number)])->values();
        $byPlayer = $roster->keyBy('player_id');

        $cur = array_key_last($s['sets']);
        $set = $cur === null ? null : $s['sets'][$cur];
        $finished = $live?->status === 'final';
        $rules = self::rules();

        $teamRows = [];
        foreach ($teams as $i => $team) {
            $rotation = $s['inProgress'] ? $s['rotation'][$team->id] : null;
            $players = $roster->where('team_id', $team->id)->map(function (GamePlayer $gp) use ($s, $rotation) {
                $st = $s['stats'][$gp->player_id] ?? [];
                $pos = $rotation ? array_search($gp->player_id, $rotation, true) : false;

                return [
                    'playerId' => $gp->player_id,
                    'jersey' => $gp->jersey_number,
                    'name' => PlayByPlay::nameOf($gp->athlete),
                    'onCourt' => $pos !== false,
                    'position' => $pos === false ? null : $pos + 1,
                    'kills' => $st['kills'] ?? 0,
                    'aces' => $st['aces'] ?? 0,
                    'blocks' => $st['blocks'] ?? 0,
                    'pts' => array_sum($st),
                ];
            })->values()->all();

            $teamRows[] = [
                'id' => $team->id,
                'side' => $i === 0 ? 'home' : 'away',
                'name' => $team->name,
                'label' => $event->departments[$i] ?? $team->name,
                'abbreviation' => $team->abbreviation,
                'logoUrl' => $team->logo_url,
                'setsWon' => $s['setsWon'][$team->id],
                'points' => $set ? $set['points'][$team->id] : 0,
                'serving' => $s['serving'] === $team->id,
                'serverPlayerId' => $s['serving'] === $team->id && $rotation ? $rotation[0] : null,
                'rotation' => $rotation,
                'defaultRotation' => self::defaultRotation($roster, $team->id),
                'timeoutsLeft' => $rules['timeouts_per_set'] - ($set ? $set['timeouts'][$team->id] : 0),
                'substitutionsLeft' => $rules['substitutions_per_set'] - ($set ? $set['subs'][$team->id] : 0),
                'oppErrorPoints' => $s['oppErrors'][$team->id],
                'players' => $players,
            ];
        }

        $nextSet = null;
        if (! $s['inProgress'] && ! $s['winner'] && ! $finished) {
            $prevFirst = $set['firstServer'] ?? null;
            $nextSet = [
                'number' => count($s['sets']) + 1,
                'target' => self::target(count($s['sets']) + 1, $bestOf),
                // FIBA alternates the first serve set to set.
                'suggestedServerTeamId' => $prevFirst ? ($prevFirst === $teams[0]->id ? $teams[1]->id : $teams[0]->id) : null,
            ];
        }

        $name = fn (?string $id) => $id && $byPlayer->has($id) ? PlayByPlay::nameOf($byPlayer[$id]->athlete) : null;
        $jersey = fn (?string $id) => $id && $byPlayer->has($id) ? $byPlayer[$id]->jersey_number : null;

        return [
            ...$base,
            'status' => $finished ? 'finished' : ($s['plays']->isEmpty() ? 'scheduled' : 'live'),
            'currentSet' => $set['number'] ?? 0,
            'setInProgress' => $s['inProgress'],
            'target' => $set ? self::target($set['number'], $bestOf) : self::target(1, $bestOf),
            'matchDecided' => (bool) $s['winner'],
            'winnerTeamId' => $s['winner'],
            'bestOfLocked' => count($s['sets']) > 0,
            'nextSet' => $nextSet,
            'playCount' => $s['plays']->count(),
            'teams' => $teamRows,
            'sets' => array_map(fn ($x) => [
                'number' => $x['number'],
                'home' => $x['points'][$teams[0]->id],
                'away' => $x['points'][$teams[1]->id],
                'winnerTeamId' => $x['winner'],
            ], $s['sets']),
            'log' => $s['plays']->reverse()->take(15)->map(fn (GameEvent $p) => [
                'id' => $p->id,
                'type' => $p->type,
                'teamId' => $p->team_id,
                'playerId' => $p->player_id,
                'jersey' => $jersey($p->player_id),
                'playerName' => $name($p->player_id),
                'playerOutJersey' => $jersey($p->player_out_id),
                'playerOutName' => $name($p->player_out_id),
                'set' => $s['log'][$p->id]['set'],
                'homeScore' => $s['log'][$p->id]['home'],
                'awayScore' => $s['log'][$p->id]['away'],
            ])->values()->all(),
        ];
    }
}
