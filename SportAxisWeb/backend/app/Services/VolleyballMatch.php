<?php

namespace App\Services;

use App\Models\Event;
use App\Models\GameEvent;
use App\Models\GamePlayer;
use App\Models\LiveScore;
use App\Models\User;
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
                    // The whistle for the first serve (when "Start set" was
                    // pressed) and for the set's last point: FIVB set duration.
                    'startedAt' => $p->created_at?->toIso8601String(),
                    'endedAt' => null,
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
                    $s['sets'][$cur]['endedAt'] = $p->created_at?->toIso8601String();
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

    /**
     * Everything the FIVB-style paper scoresheet records, from the rally log —
     * for the committee's filled-in PDF. Per set and team (side 0 = team A,
     * the home side; 1 = B): the starting line-up in positions I–VI,
     * substitutions under the starting player's column with the score at the
     * change ("own:opp"), the service rounds (the team's score each time a
     * server lost the serve — `x` where a receiving team's first box is
     * crossed out, `last` on the set's final point), time-outs with the
     * score, the points, and the set's start and end. Not public: the
     * rosters carry student numbers.
     */
    public function sheet(Event $event): array
    {
        $teams = PlayByPlay::teams($event);
        $live = LiveScore::where('event_id', $event->id)->first();
        $bestOf = self::bestOf($live);
        $roster = GamePlayer::with('athlete.account')->where('game_id', $event->id)->get();
        $jersey = fn (?string $id) => $id ? $roster->firstWhere('player_id', $id)?->jersey_number : null;

        $base = [
            'event' => [
                'name' => $event->name,
                'category' => $event->category,
                'schedule' => $event->schedule ? substr((string) $event->schedule, 0, 10) : null,
                'startTime' => $event->start_time,
                'venueName' => $event->venue_name,
                'departments' => array_values($event->departments ?? []),
            ],
            'status' => $live?->status === 'final' ? 'finished' : ($live ? 'live' : 'scheduled'),
            'bestOf' => $bestOf,
            'umpires' => collect($event->judges ?? [])->pluck('name')->filter()->values()->all(),
        ];
        if (! $teams) {
            return [...$base, 'teams' => [], 'sets' => [], 'winner' => null];
        }

        $side = [$teams[0]->id => 0, $teams[1]->id => 1];
        $plays = GameEvent::where('game_id', $event->id)->orderBy('id')->get();
        $sets = [];
        $set = null;
        $rotation = [null, null];
        $slotOf = [[], []];
        $turn = [0, 0];
        $offset = [0, 0];
        $serving = null;

        $closeBox = function (int $s, bool $last = false) use (&$set, &$turn, &$offset) {
            $n = $turn[$s] + $offset[$s];
            $set['teams'][$s]['rounds'][$n % 6][intdiv($n, 6)] = ['score' => $set['teams'][$s]['points'], 'last' => $last];
        };

        foreach ($plays as $p) {
            $s = $side[$p->team_id] ?? null;
            if ($s === null) {
                continue;
            }
            if ($p->type === 'SET_START') {
                if ($set) {
                    $sets[] = $set;
                }
                $rots = (array) ($p->detail['rotations'] ?? []);
                $rotation = [$rots[$teams[0]->id] ?? null, $rots[$teams[1]->id] ?? null];
                $slotOf = array_map(fn ($r) => $r ? array_flip($r) : [], $rotation);
                $set = [
                    'number' => count($sets) + 1,
                    'target' => self::target(count($sets) + 1, $bestOf),
                    'firstServer' => $s,
                    'startedAt' => $p->created_at?->toIso8601String(),
                    'endedAt' => null,
                    'winner' => null,
                    'teams' => array_map(fn ($r) => [
                        'points' => 0,
                        'starting' => $r ? array_map($jersey, $r) : null,
                        'subs' => [],
                        'rounds' => array_fill(0, 6, []),
                        'timeouts' => [],
                    ], $rotation),
                ];
                // The first server's box I is open; the receiver serves from II
                // (its box I is crossed out).
                $serving = $s;
                // The receiver's first serve (turn 0) comes after its first side-out.
                $turn = [$s === 0 ? 0 : -1, $s === 1 ? 0 : -1];
                $offset = [$s === 0 ? 0 : 1, $s === 1 ? 0 : 1];
                $set['teams'][1 - $s]['rounds'][0][0] = ['x' => true];
            } elseif (! $set || $set['winner'] !== null) {
                continue;
            } elseif (in_array($p->type, self::POINT_TYPES, true)) {
                if ($serving !== $s) {
                    $closeBox($serving);                              // the server lost the serve
                    if ($rotation[$s]) {
                        $rotation[$s] = [...array_slice($rotation[$s], 1), $rotation[$s][0]];
                    }
                    $turn[$s]++;
                    $serving = $s;
                }
                $set['teams'][$s]['points']++;
                $mine = $set['teams'][$s]['points'];
                $theirs = $set['teams'][1 - $s]['points'];
                if ($mine >= $set['target'] && $mine - $theirs >= self::rules()['win_by']) {
                    $closeBox($s, last: true);
                    $set['winner'] = $s;
                    $set['endedAt'] = $p->created_at?->toIso8601String();
                }
            } elseif ($p->type === 'TIMEOUT') {
                $set['teams'][$s]['timeouts'][] = $set['teams'][$s]['points'].':'.$set['teams'][1 - $s]['points'];
            } elseif ($p->type === 'SUB') {
                $col = $slotOf[$s][$p->player_out_id] ?? null;
                if ($col !== null) {
                    $slotOf[$s][$p->player_id] = $col;
                }
                $set['teams'][$s]['subs'][] = [
                    'column' => $col,
                    'jersey' => $jersey($p->player_id),
                    'score' => $set['teams'][$s]['points'].':'.$set['teams'][1 - $s]['points'],
                ];
                if ($rotation[$s] && ($i = array_search($p->player_out_id, $rotation[$s], true)) !== false) {
                    $rotation[$s][$i] = $p->player_id;
                }
            }
        }
        if ($set) {
            $sets[] = $set;
        }
        // Each position's rounds as a plain list (null = not reached), not a sparse map.
        foreach ($sets as &$done) {
            foreach ($done['teams'] as &$t) {
                $t['rounds'] = array_map(function ($col) {
                    $out = [];
                    for ($r = 0, $max = $col ? max(array_keys($col)) : -1; $r <= $max; $r++) {
                        $out[] = $col[$r] ?? null;
                    }

                    return $out;
                }, $t['rounds']);
            }
            unset($t);
        }
        unset($done);

        $coachNames = User::whereIn('id', $roster->pluck('athlete.coach_id')->filter()->unique())->pluck('name', 'id');
        $teamRows = [];
        foreach ($teams as $i => $team) {
            $mine = $roster->where('team_id', $team->id);
            $teamRows[] = [
                'name' => $team->name,
                'abbreviation' => $team->abbreviation,
                'setsWon' => count(array_filter($sets, fn ($x) => $x['winner'] === $i)),
                'coach' => $coachNames[$mine->pluck('athlete.coach_id')->filter()->countBy()->sortDesc()->keys()->first()] ?? null,
                'players' => $mine->sortBy(fn (GamePlayer $gp) => [(int) $gp->jersey_number, strlen($gp->jersey_number)])
                    ->map(fn (GamePlayer $gp) => [
                        'jersey' => $gp->jersey_number,
                        'name' => PlayByPlay::nameOf($gp->athlete),
                        'licence' => $gp->athlete?->account?->sr_code ?: $gp->athlete?->student_id,
                    ])->values()->all(),
            ];
        }
        $need = self::setsToWin($bestOf);
        $winner = collect($teamRows)->search(fn ($t) => $t['setsWon'] >= $need);

        return [...$base, 'teams' => $teamRows, 'sets' => $sets, 'winner' => $winner === false ? null : $winner];
    }

    private const POINT_TYPES = ['KILL', 'ACE', 'BLOCK', 'OPP_ERROR'];

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
                'startedAt' => $x['startedAt'],
                'endedAt' => $x['endedAt'],
            ], $s['sets']),
            // Server time now, so a phone can run the set clock without trusting its own clock.
            'serverTime' => now()->toIso8601String(),
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
