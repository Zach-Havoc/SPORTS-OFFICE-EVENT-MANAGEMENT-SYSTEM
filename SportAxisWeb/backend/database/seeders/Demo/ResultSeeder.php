<?php

namespace Database\Seeders\Demo;

use App\Models\Bracket;
use App\Models\BracketMatch;
use App\Models\Event;
use App\Models\GamePlayer;
use App\Services\DemoData\DemoContext;
use App\Services\DemoData\DemoScheduler;
use App\Services\PlayByPlay;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Plays the calendar up to now, the way the scorers record it: every game
 * before today gets a final score and a result, elimination brackets
 * advance (carrying lineups forward), and at every venue with games today
 * the first half are done, one is live right now and the rest are still to
 * come. Once Men's Volleyball's group stage is done its top four go into
 * playoffs.
 *
 *   Basketball        55–95 a side, full play-by-play (box scores, player stats)
 *   Volleyball        best of 5, sets to 25 (5th to 15), win by 2, rally by rally
 *   Beach Volleyball  best of 3, sets to 21 (3rd to 15)
 *   Sepak Takraw      best of 3, sets to 21 (3rd to 15)
 *   Badminton         best of 3 games to 21
 *   Table Tennis      best of 5 games to 11
 *   Chess             four boards, 1 / ½ / 0 each
 */
class ResultSeeder extends Seeder
{
    private DemoContext $ctx;

    private DemoScheduler $sched;

    /** Rows written in bulk at the end. */
    private array $plays = [];

    private array $performance = [];

    private const NOTES = [
        'Basketball' => [
            'Great court vision; pushed the pace in transition all game.',
            'Solid on-ball defense. Needs to be quicker closing out on shooters.',
            'Led the second-half run. Free-throw shooting still inconsistent.',
            'Rebounded well on both ends; keep working on the weak hand.',
            'Composed under pressure; good decisions in the last two minutes.',
        ],
        'Volleyball' => [
            'Sharp on the block and read the setter well.',
            'Serve receive was steady; keep attacking the seams.',
            'Big swings at the end of sets — trust that approach.',
            'Good energy on the floor; work on the jump float.',
        ],
    ];

    public function run(DemoContext $ctx): void
    {
        $this->ctx = $ctx;
        $this->sched = new DemoScheduler($ctx);

        $this->playPast();
        $this->sched->playoffs('Volleyball — Men', 'Covered Court A', [0, 2], '08:00', 90);
        $this->today();
        $this->sched->lineUpRemaining();

        foreach (Bracket::all() as $bracket) {
            $this->sched->service()->resolve($bracket);
        }
        $this->flush();
    }

    // ── The calendar ────────────────────────────────────────────────────

    /** Every game before today, in order — an elimination winner reaches the next round before it's played. */
    private function playPast(): void
    {
        $skip = [];
        while ($event = Event::where('status', 'upcoming')->whereDate('schedule', '<', $this->ctx->today)
            ->whereNotIn('id', $skip)->orderBy('schedule')->orderBy('start_time')->orderBy('venue_name')->orderBy('name')->first()) {
            if (count($event->departments ?? []) === 2) {
                $this->play($event);
            } else {
                $skip[] = $event->id;
            }
        }
    }

    /**
     * Today, venue by venue: the games are re-timed around now so that the
     * first ones are over, one is being played now and the rest follow.
     */
    private function today(): void
    {
        $games = Event::whereDate('schedule', $this->ctx->today)->where('status', 'upcoming')->get()
            ->filter(fn ($e) => count($e->departments ?? []) === 2)
            ->sortBy('venue_name')->groupBy('venue_name');

        $now = now()->floorMinutes(5);
        $dayStart = $this->ctx->today->copy()->setTime(7, 0);
        foreach ($games as $venueGames) {
            $venueGames = $venueGames->sortBy(fn ($e) => [$e->start_time, $e->name])->values();
            $length = fn (Event $e) => max(30, Carbon::parse($e->start_time)->diffInMinutes(Carbon::parse($e->end_time)));
            $step = $length($venueGames[0]) + 15;

            $liveStart = $now->copy()->subMinutes(30)->max($this->ctx->today);
            $done = min(intdiv($venueGames->count(), 2), max(0, intdiv((int) $dayStart->diffInMinutes($liveStart, false), $step)));

            foreach ($venueGames as $k => $event) {
                $start = $liveStart->copy()->addMinutes(($k - $done) * $step);
                // Past tonight: the rest go to tomorrow evening, after the day's schedule.
                if (! $start->isSameDay($this->ctx->today) || $start->hour >= 23) {
                    $start = $this->ctx->today->copy()->addDay()->setTime(18, 0)->addMinutes(($k - $done) * $step);
                }
                $event = $this->sched->move($event, $start->copy()->startOfDay(), $start->format('H:i'), $length($event));

                if ($k < $done) {
                    $this->play($event);
                } elseif ($k === $done) {
                    $this->goLive($event);
                }
            }
        }
    }

    // ── Results ─────────────────────────────────────────────────────────

    /**
     * Record a game: the final score on the live board, the head-to-head
     * result, the game completed, and a bracket game advanced.
     */
    private function play(Event $event): void
    {
        $this->sched->lineUp($event, onlyMissing: true);   // e.g. a team off a bye
        [$home, $away] = array_values($event->departments);
        $homeWins = $this->homeWins($event->category, $home, $away);
        [$sport] = DemoContext::parse($event->category);

        [$h, $a, $meta, $period] = match ($sport) {
            'Basketball' => $this->basketball($event, $homeWins),
            'Volleyball' => $this->volleyball($event, $homeWins),
            'Chess' => $this->chess($homeWins),
            default => $this->setsGame($sport, $homeWins),
        };

        [$start] = $this->sched->window($event);
        $end = $start->copy()->addMinutes(max(30, Carbon::parse($event->start_time)->diffInMinutes(Carbon::parse($event->end_time))));
        $judge = $event->judges[0]['id'] ?? $this->ctx->judges[0]->id;
        $winner = $h > $a ? $home : $away;
        $bracketMatch = BracketMatch::where('event_id', $event->id)->first();

        DB::table('live_scores')->insert([
            'id' => (string) Str::uuid(), 'event_id' => $event->id, 'sport' => $event->category,
            'home_team' => $home, 'away_team' => $away, 'home_score' => $h, 'away_score' => $a,
            'period' => $period, 'current_period' => $meta['current'] ?? null,
            'detail' => json_encode($meta['detail'] ?? []), 'status' => 'final', 'version' => $meta['version'] ?? 1,
            'updated_by' => $judge, 'started_at' => $start, 'finalized_at' => $end,
            'created_at' => $start, 'updated_at' => $end,
        ]);
        DB::table('team_matches')->insert([
            'id' => (string) Str::uuid(), 'sport' => $event->category,
            'stage' => $bracketMatch ? ($bracketMatch->bracket->format === 'round_robin' ? 'group' : 'elimination') : 'friendly',
            'event_id' => $event->id, 'home_team' => $home, 'away_team' => $away, 'home_score' => $h, 'away_score' => $a,
            'winner' => $winner, 'is_draw' => false, 'status' => 'completed',
            'played_at' => $end, 'recorded_by' => $judge, 'created_at' => $end, 'updated_at' => $end,
        ]);
        DB::table('events')->where('id', $event->id)->update(['status' => 'completed']);

        if ($bracketMatch?->bracket->format === 'single_elimination') {
            $this->sched->service()->advanceFromEvent($event->id);
        } elseif ($bracketMatch) {
            DB::table('bracket_matches')->where('id', $bracketMatch->id)->update([
                'winner' => $winner, 'loser' => $winner === $home ? $away : $home, 'status' => 'completed',
            ]);
        }
    }

    /** A game in progress right now, with a partial score. */
    private function goLive(Event $event): void
    {
        $this->sched->lineUp($event, onlyMissing: true);
        [$home, $away] = array_values($event->departments);
        $homeWins = $this->homeWins($event->category, $home, $away);
        [$sport] = DemoContext::parse($event->category);

        [$h, $a, $meta, $period] = match ($sport) {
            'Basketball' => $this->basketball($event, $homeWins, upTo: 3),
            'Volleyball' => $this->volleyball($event, $homeWins, live: true),
            'Chess' => $this->chess($homeWins, live: true),
            default => $this->setsGame($sport, $homeWins, live: true),
        };

        [$start] = $this->sched->window($event);
        DB::table('events')->where('id', $event->id)->update(['status' => 'ongoing']);
        DB::table('live_scores')->insert([
            'id' => (string) Str::uuid(), 'event_id' => $event->id, 'sport' => $event->category,
            'home_team' => $home, 'away_team' => $away, 'home_score' => $h, 'away_score' => $a,
            'period' => $period, 'current_period' => $meta['current'] ?? null,
            'detail' => json_encode($meta['detail'] ?? []), 'status' => 'in_progress', 'version' => $meta['version'] ?? 9,
            'updated_by' => $event->judges[0]['id'] ?? null, 'started_at' => $start,
            'created_at' => $start, 'updated_at' => now(),
        ]);
    }

    /** Stronger colleges usually win; upsets happen (a 92 beats a 78 about two times in three). */
    private function homeWins(string $category, string $home, string $away): bool
    {
        $h = $this->ctx->strength($category, $home) ** 4;
        $a = $this->ctx->strength($category, $away) ** 4;

        return mt_rand(1, 1000) <= (int) (1000 * $h / ($h + $a));
    }

    // ── Basketball ──────────────────────────────────────────────────────

    /**
     * Full play-by-play: every basket, free throw and foul by the lineups'
     * players, quarter by quarter, adding up exactly to the final score.
     * `$upTo` stops after that quarter (a game still being played).
     */
    private function basketball(Event $event, bool $homeWins, ?int $upTo = null): array
    {
        $teams = PlayByPlay::teams($event);
        $w = mt_rand(62, 95);
        $l = max(55, $w - mt_rand(2, 22));
        $scores = $homeWins ? [$w, $l] : [$l, $w];
        $judge = $event->judges[0]['id'] ?? null;
        [$clock] = $this->sched->window($event);
        $quarters = $rosters = [[], []];
        $fouls = $stats = $rows = [];

        foreach ($teams as $i => $team) {
            $rosters[$i] = GamePlayer::where('game_id', $event->id)->where('team_id', $team->id)
                ->orderByDesc('is_starter')->orderBy('id')->pluck('player_id')->all();
            $quarters[$i] = $this->split($scores[$i], 4);
        }

        for ($q = 1; $q <= ($upTo ?? 4); $q++) {
            $quarterPlays = [];
            foreach ($teams as $i => $team) {
                $left = $quarters[$i][$q - 1];
                while ($left > 0) {
                    $r = mt_rand(1, 100);
                    $type = $left >= 3 && $r <= 22 ? 'FG3' : ($left >= 2 && $r <= 82 ? 'FG2' : 'FT');
                    $left -= ['FG3' => 3, 'FG2' => 2, 'FT' => 1][$type];
                    $quarterPlays[] = [$team->id, $this->pickPlayer($rosters[$i], 94), $type];
                }
                for ($f = mt_rand(2, 5); $f > 0; $f--) {
                    $eligible = array_values(array_filter($rosters[$i], fn ($p) => ($fouls[$p] ?? 0) < 4));
                    if ($eligible) {
                        $p = $this->pickPlayer($eligible, 100);
                        $fouls[$p] = ($fouls[$p] ?? 0) + 1;
                        $quarterPlays[] = [$team->id, $p, 'FOUL'];
                    }
                }
            }
            // One time-out a team in the 2nd and 4th quarters (FIBA allows 2 and 3 a half).
            if ($q === 2 || $q === 4) {
                foreach ($teams as $team) {
                    $quarterPlays[] = [$team->id, null, 'TIMEOUT'];
                }
            }
            shuffle($quarterPlays);
            foreach ($quarterPlays as $k => [$teamId, $playerId, $type]) {
                $clock->addSeconds(mt_rand(15, 50));
                // Spread over the 10-minute quarter: the game clock left when it happened.
                $left = (int) (600 - ($k + 1) * 600 / (count($quarterPlays) + 1));
                $rows[] = $this->playRow($event->id, $teamId, $playerId, $type, $q, $judge, $clock, sprintf('%02d:%02d', intdiv($left, 60), $left % 60));
                if ($playerId) {
                    $stats[$playerId][$type] = ($stats[$playerId][$type] ?? 0) + 1;
                }
            }
        }
        array_push($this->plays, ...$rows);

        if ($upTo) {
            $scores = array_map(fn ($i) => array_sum(array_slice($quarters[$i], 0, $upTo)), [0, 1]);
        } else {
            $this->performanceFrom($event, 'Basketball', $stats, fn ($s) => [
                'points' => 2 * ($s['FG2'] ?? 0) + 3 * ($s['FG3'] ?? 0) + ($s['FT'] ?? 0),
                'twoPointers' => $s['FG2'] ?? 0, 'threePointers' => $s['FG3'] ?? 0,
                'freeThrows' => $s['FT'] ?? 0, 'fouls' => $s['FOUL'] ?? 0,
            ], 'points');
        }
        $period = $upTo ?? 4;

        return [$scores[0], $scores[1], ['current' => $period, 'version' => count($rows), 'detail' => []], 'Q'.$period];
    }

    // ── Volleyball ──────────────────────────────────────────────────────

    /**
     * Best of five, rally by rally: each set starts from the lineups'
     * rotations, and serve and rotation are tracked the way the scorer
     * replays them (a side-out rotates the team; an ace is the server's).
     * Live, it stops partway through the third set.
     */
    private function volleyball(Event $event, bool $homeWins, bool $live = false): array
    {
        $teams = PlayByPlay::teams($event);
        $judge = $event->judges[0]['id'] ?? null;
        [$clock] = $this->sched->window($event);
        $ids = [$teams[0]->id, $teams[1]->id];
        $starting = [];
        foreach ($ids as $i => $id) {
            $rot = GamePlayer::where('game_id', $event->id)->where('team_id', $id)->whereNotNull('rotation_position')
                ->orderBy('rotation_position')->pluck('player_id')->all();
            $starting[$i] = count($rot) === 6 ? $rot : null;
        }

        // The winner takes three; the loser takes none, one or two, never the last.
        $winner = $homeWins ? 0 : 1;
        $lost = [0 => 20, 1 => 45, 2 => 35];
        $r = mt_rand(1, 100);
        $loserSets = $r <= $lost[0] ? 0 : ($r <= $lost[0] + $lost[1] ? 1 : 2);
        $order = [...array_fill(0, $loserSets, 1 - $winner), ...array_fill(0, 2, $winner)];
        shuffle($order);
        $setWinners = [...$order, $winner];
        if ($live) {
            $setWinners = [$winner, 1 - $winner, $winner];   // 1–1, the third under way
        }

        $rows = $sets = $stats = [];
        $firstServer = mt_rand(0, 1);
        foreach ($setWinners as $s => $sw) {
            $sequence = $this->rallySequence($sw, $s === 4 ? 15 : 25);
            if ($live && $s === 2) {
                $sequence = array_slice($sequence, 0, (int) (count($sequence) * 0.6));
            }
            $rotation = $starting;
            $serving = ($firstServer + $s) % 2;
            $clock->addMinutes(3);
            $rows[] = [
                'game_id' => $event->id, 'team_id' => $ids[$serving], 'player_id' => null, 'player_out_id' => null,
                'type' => 'SET_START', 'period' => $s + 1, 'game_clock' => null,
                'detail' => json_encode(['rotations' => [$ids[0] => $rotation[0], $ids[1] => $rotation[1]]]),
                'recorded_by' => $judge, 'created_at' => $clock->copy(), 'updated_at' => $clock->copy(), 'deleted_at' => null,
            ];
            $points = [0, 0];
            foreach ($sequence as $side) {
                $sideOut = $serving !== $side;
                if ($sideOut && $rotation[$side]) {
                    $rotation[$side] = [...array_slice($rotation[$side], 1), $rotation[$side][0]];
                }
                $serving = $side;
                $r = mt_rand(1, 100);
                if (! $sideOut && $r <= 12) {
                    [$type, $player] = ['ACE', $rotation[$side][0] ?? null];
                } else {
                    $type = $r <= 62 ? 'KILL' : ($r <= 78 ? 'BLOCK' : 'OPP_ERROR');
                    $player = $type === 'OPP_ERROR' || ! $rotation[$side] ? null : $rotation[$side][mt_rand(0, 5)];
                }
                $points[$side]++;
                $clock->addSeconds(mt_rand(20, 45));
                $rows[] = $this->playRow($event->id, $ids[$side], $player, $type, $s + 1, $judge, $clock);
                if ($player) {
                    $stats[$player][$type] = ($stats[$player][$type] ?? 0) + 1;
                }
            }
            $sets[] = $points;
        }
        array_push($this->plays, ...$rows);

        $done = $live ? array_slice($sets, 0, 2) : $sets;
        $won = [0, 0];
        foreach ($done as [$x, $y]) {
            $won[$x > $y ? 0 : 1]++;
        }
        $last = end($sets);
        if (! $live) {
            $this->performanceFrom($event, 'Volleyball', $stats, fn ($s) => [
                'kills' => $s['KILL'] ?? 0, 'aces' => $s['ACE'] ?? 0, 'blocks' => $s['BLOCK'] ?? 0,
                'points' => ($s['KILL'] ?? 0) + ($s['ACE'] ?? 0) + ($s['BLOCK'] ?? 0),
            ], 'points');
        }

        return [$won[0], $won[1], [
            'current' => count($sets), 'version' => count($rows),
            'detail' => ['bestOf' => 5, 'sets' => $sets],
        ], 'Set '.count($sets).' · '.$last[0].'–'.$last[1]];
    }

    /**
     * Who wins each rally of a set `$winner` takes: nobody reaches the
     * target early, and a deuce set runs on until a two-point lead.
     */
    private function rallySequence(int $winner, int $target): array
    {
        $loser = 1 - $winner;
        if (mt_rand(1, 100) <= 18) {   // deuce
            $seq = [...array_fill(0, $target - 1, $winner), ...array_fill(0, $target - 1, $loser)];
            shuffle($seq);
            for ($k = mt_rand(0, 2); $k > 0; $k--) {
                array_push($seq, ...(mt_rand(0, 1) ? [$winner, $loser] : [$loser, $winner]));
            }

            return [...$seq, $winner, $winner];
        }
        $seq = [...array_fill(0, $target - 1, $winner), ...array_fill(0, mt_rand((int) ($target * 0.45), $target - 2), $loser)];
        shuffle($seq);

        return [...$seq, $winner];
    }

    // ── Set sports and chess ────────────────────────────────────────────

    /**
     * Beach volleyball, sepak takraw, badminton, table tennis: the sets (or
     * games) and the final. Sometimes a set goes to deuce. Live, the match
     * is one set short of done with the next under way.
     */
    private function setsGame(string $sport, bool $homeWins, bool $live = false): array
    {
        [$bestOf, $target, $decider, $label, $cap] = match ($sport) {
            'Beach Volleyball' => [3, 21, 15, 'Set', 99],
            'Sepak Takraw' => [3, 21, 15, 'Set', 25],
            'Badminton' => [3, 21, 21, 'Game', 30],
            default => [5, 11, 11, 'Game', 99],   // table tennis
        };

        $need = intdiv($bestOf, 2) + 1;
        $lost = mt_rand(0, $need - 1);
        $order = [...array_fill(0, $lost, 1), ...array_fill(0, $need - 1, 0)];
        shuffle($order);
        $order[] = 0;   // the winner takes the last one
        $sets = [];
        foreach ($order as $k => $who) {
            $t = $k === $bestOf - 1 ? $decider : $target;
            $pts = mt_rand(1, 100) <= 15
                ? [min($cap, $t + ($x = mt_rand(1, 3))), min($cap, $t + $x) - 2]    // deuce
                : [$t, mt_rand((int) ($t * 0.4), $t - 2)];
            $winnerSide = $homeWins ? $who : 1 - $who;
            $sets[] = $winnerSide === 0 ? $pts : array_reverse($pts);
        }

        if ($live) {
            array_pop($sets);   // the deciding set is still being played
            $t = count($sets) === $bestOf - 1 ? $decider : $target;
            $sets[] = [mt_rand((int) ($t * 0.3), $t - 3), mt_rand((int) ($t * 0.3), $t - 3)];
            $won = [0, 0];
            foreach (array_slice($sets, 0, -1) as [$x, $y]) {
                $won[$x > $y ? 0 : 1]++;
            }

            return [$won[0], $won[1], ['current' => count($sets), 'detail' => ['bestOf' => $bestOf, 'sets' => $sets]], $label.' '.count($sets)];
        }

        $scores = $homeWins ? [$need, $lost] : [$lost, $need];

        return [$scores[0], $scores[1], ['current' => count($sets), 'detail' => ['bestOf' => $bestOf, 'sets' => $sets]], $label.' '.count($sets)];
    }

    /**
     * Four boards, 1 / ½ / 0 each. Draws come in pairs so a match always
     * ends 4–0 or 3–1 — a drawn match can't close a round robin.
     */
    private function chess(bool $homeWins, bool $live = false): array
    {
        $boards = match (mt_rand(1, 4)) {
            1 => [1, 1, 1, 1],
            2 => [1, 1, 1, 0],
            3 => [1, 1, 0.5, 0.5],
            default => [1, 0.5, 1, 0.5],
        };
        shuffle($boards);
        if (! $homeWins) {
            $boards = array_map(fn ($b) => 1 - $b, $boards);
        }

        if ($live) {
            $boards = [1, 0, null, null];   // two games still on the clock
            shuffle($boards);

            return [1, 1, ['current' => 2, 'detail' => ['boards' => $boards]], 'Boards 3–4 in play'];
        }
        $home = (int) array_sum($boards);

        return [$home, 4 - $home, ['current' => 4, 'detail' => ['boards' => $boards]], 'Final'];
    }

    // ── Helpers ─────────────────────────────────────────────────────────

    private function flush(): void
    {
        foreach (array_chunk($this->plays, 500) as $chunk) {
            DB::table('game_events')->insert($chunk);
        }
        foreach (array_chunk($this->performance, 400) as $chunk) {
            DB::table('performance_records')->insert($chunk);
        }
        $this->plays = $this->performance = [];
    }

    private function playRow(string $gameId, string $teamId, ?string $playerId, string $type, int $period, ?string $judge, Carbon $at, ?string $gameClock = null): array
    {
        return [
            'game_id' => $gameId, 'team_id' => $teamId, 'player_id' => $playerId, 'player_out_id' => null,
            'type' => $type, 'period' => $period, 'game_clock' => $gameClock, 'detail' => null, 'recorded_by' => $judge,
            'created_at' => $at->copy(), 'updated_at' => $at->copy(), 'deleted_at' => null,
        ];
    }

    /** A coach's performance note for everyone who figured in a game's play-by-play. */
    private function performanceFrom(Event $event, string $sport, array $stats, callable $metrics, string $key): void
    {
        [$start] = $this->sched->window($event);
        $at = $start->copy()->setTime(20, 0);
        foreach ($stats as $playerId => $s) {
            $a = $this->ctx->athletes[$playerId] ?? null;
            if (! $a) {
                continue;
            }
            $m = $metrics($s);
            $notes = self::NOTES[$sport];
            $this->performance[] = [
                'id' => (string) Str::uuid(), 'athlete_id' => $a->id, 'athlete_name' => "{$a->first_name} {$a->last_name}",
                'event_id' => $event->id, 'event_name' => $event->name, 'sport' => $sport,
                'metrics' => json_encode($m), 'overall_rating' => max(5, min(10, 5 + intdiv($m[$key], $sport === 'Basketball' ? 4 : 3))),
                'coach_notes' => $notes[crc32($playerId.$event->id) % count($notes)],
                'recorded_by' => $a->coach_id, 'recorded_at' => $at, 'created_at' => $at, 'updated_at' => $at,
            ];
        }
    }

    /** Most plays go to the starters; `$assignedPct` of them name a player at all. */
    private function pickPlayer(array $roster, int $assignedPct): ?string
    {
        if (! $roster || mt_rand(1, 100) > $assignedPct) {
            return null;
        }
        $weighted = [];
        foreach ($roster as $i => $p) {
            array_push($weighted, ...array_fill(0, $i < 5 ? 4 : 1, $p));
        }

        return $weighted[mt_rand(0, count($weighted) - 1)];
    }

    /** Split a total into `$parts` roughly even, non-zero pieces. */
    private function split(int $total, int $parts): array
    {
        $weights = array_map(fn () => mt_rand(80, 120), range(1, $parts));
        $sum = array_sum($weights);
        $out = array_map(fn ($w) => (int) floor($total * $w / $sum), $weights);
        $out[mt_rand(0, $parts - 1)] += $total - array_sum($out);

        return $out;
    }
}
