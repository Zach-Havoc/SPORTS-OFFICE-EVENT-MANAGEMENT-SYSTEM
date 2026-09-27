<?php

namespace Database\Seeders;

use App\Http\Controllers\Api\RankingController;
use App\Models\AuditLog;
use App\Models\Bracket;
use App\Models\BracketMatch;
use App\Models\Event;
use App\Models\GamePlayer;
use App\Models\TeamMatch;
use App\Services\BracketService;
use App\Services\LineupRules;
use App\Services\PlayByPlay;
use App\Support\EventQr;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Steps 2 and 3, after TournamentResetSeeder: fill the fresh intramurals with
 * three weeks of competition and everyday records, so every screen has real
 * data to show. Split in two so neither runs past a shared host's request
 * time limit:
 *
 *   step 2 — TournamentGamesSeeder: basketball, volleyball, beach volleyball,
 *            sepak takraw and chess, plus friendlies
 *   step 3 — this class: the racquet lines' brackets and everyday records
 *
 * Competition (every bracket through the real BracketService, every result
 * the way the scorers record it — a result, a final live score, the bracket
 * advancing):
 *   Basketball, Volleyball   Men's and Women's round-robin group stage, then
 *                            top-4 single-elimination playoffs. Men's
 *                            Basketball's final is live right now; Men's
 *                            Volleyball's final is tomorrow.
 *   Beach Volleyball         single elimination — Men's done, Women's in the semis
 *   Sepak Takraw, Chess      round-robin leagues — one game live, the last few upcoming
 *   Badminton, Table Tennis  a single-elimination bracket per line; a Table
 *                            Tennis final is live, a Badminton final and a
 *                            whole doubles bracket are still to play
 * plus a few friendlies across colleges next week. Basketball and volleyball
 * games carry full play-by-play (so box scores and player stats are real);
 * every known matchup has both lineups; every coach's racquet lines are in.
 *
 * Everyday records: announcements and tryouts with applicants, attendance,
 * performance notes from the games, eligibility requirements at every stage,
 * appeals, and notifications.
 *
 *   /artisan-migrate?token=<TOKEN>&seed=1&class=TournamentGamesSeeder
 *   /artisan-migrate?token=<TOKEN>&seed=1&class=TournamentActivitySeeder
 */
class TournamentActivitySeeder extends Seeder
{
    /** 'games' (step 2, TournamentGamesSeeder) or 'activity' (step 3). */
    protected string $part = 'activity';

    private BracketService $brackets;

    private Carbon $today;

    private string $adminId;

    /** @var array<int, string> college names, in TournamentResetSeeder::COLLEGES order */
    private array $colleges = [];

    /** @var array<string, string> college name => abbreviation */
    private array $abbr = [];

    /** @var array<string, array{Men: object, Women: object}> college name => coaches */
    private array $coaches = [];

    /** @var array<int, object> */
    private array $judges = [];

    private int $judgeTurn = 0;

    /** @var array<string, string> venue name => id */
    private array $venues = [];

    /** @var array<string, object> athlete id => row */
    private array $athletes = [];

    /** @var array<string, array<string, int>> sport => college => strength */
    private array $strength = [];

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

    public function run(): void
    {
        if (! DB::table('users')->where('email', 'coach1'.TournamentResetSeeder::DOMAIN)->exists()) {
            throw new \RuntimeException('Run TournamentResetSeeder first — the accounts this fills in are missing.');
        }
        $gamesDone = DB::table('brackets')->exists();
        $activityDone = DB::table('brackets')->where('sport', 'like', 'Badminton%')->exists();
        if ($this->part === 'games' && $gamesDone) {
            throw new \RuntimeException('The games are already filled in. Run TournamentResetSeeder again first to start over.');
        }
        if ($this->part === 'activity' && ! $gamesDone) {
            throw new \RuntimeException('Run TournamentGamesSeeder first (step 2).');
        }
        if ($this->part === 'activity' && $activityDone) {
            throw new \RuntimeException('Already filled in. Run TournamentResetSeeder again first to start over.');
        }
        @set_time_limit(300);
        mt_srand(2627);

        $this->load();

        AuditLog::withoutRecording(function () {
            if ($this->part === 'games') {
                $this->teamCompetition();
                $this->friendlies();
                $this->lineUpByes();
                $this->flush();
            } else {
                $this->racquetLines();
                $this->racquetCompetition();
                $this->everydayRecords();
            }
        });

        Cache::flush();

        $this->command?->info(sprintf(
            'Filled in — %d brackets, %d games (%d played, %d live), %d play-by-play plays.',
            DB::table('brackets')->count(), DB::table('events')->count(),
            DB::table('events')->where('status', 'completed')->count(), DB::table('events')->where('status', 'ongoing')->count(),
            DB::table('game_events')->count(),
        ));
    }

    private function load(): void
    {
        $this->brackets = app(BracketService::class);
        $this->today = Carbon::today();
        $this->adminId = DB::table('users')->where('role', 'admin')->value('id');
        $this->colleges = array_values(TournamentResetSeeder::COLLEGES);
        $this->abbr = array_flip(TournamentResetSeeder::COLLEGES);

        foreach (DB::table('users')->where('role', 'coach')->get() as $coach) {
            $this->coaches[$coach->department][$coach->gender_category] = $coach;
        }
        $this->judges = DB::table('users')->where('role', 'judge')->orderBy('created_at')->orderBy('email')->get()->all();
        $this->venues = DB::table('venues')->pluck('id', 'name')->all();
        foreach (DB::table('athletes')->get(['id', 'coach_id', 'first_name', 'last_name', 'sport', 'jersey_number', 'department']) as $a) {
            $this->athletes[$a->id] = $a;
        }
    }

    // ── Competition ─────────────────────────────────────────────────────

    private function teamCompetition(): void
    {
        $t = fn (int $days) => $this->today->copy()->addDays($days);

        // Basketball: group stage, then top-4 playoffs.
        $this->roundRobin('Basketball — Men', 'Joson Gymnasium', -21);
        $playoffs = $this->playoffs('Basketball — Men', 'Joson Gymnasium', -2, '08:00', 90);
        $this->playThrough($playoffs, 1);
        $this->goLiveBasketball($this->finalOf($playoffs));

        $this->roundRobin('Basketball — Women', 'Joson Gymnasium', -18);
        $playoffs = $this->playoffs('Basketball — Women', 'Joson Gymnasium', -2, '14:00', 90);
        $this->playThrough($playoffs, 99);

        // Volleyball: group stage, then top-4 playoffs.
        $this->roundRobin('Volleyball — Men', 'ARASOF Covered Court', -15);
        $playoffs = $this->playoffs('Volleyball — Men', 'ARASOF Covered Court', -1, '08:00', 90);
        $this->playThrough($playoffs, 1);
        $this->move($this->finalOf($playoffs), $t(1), '16:00', 90);

        $this->roundRobin('Volleyball — Women', 'ARASOF Covered Court', -12);
        $playoffs = $this->playoffs('Volleyball — Women', 'ARASOF Covered Court', -1, '14:00', 90);
        $this->playThrough($playoffs, 99);

        // Beach volleyball: single elimination, all seven colleges.
        $this->playThrough($this->elimination('Beach Volleyball — Men', 'Nasugbu Sand Court', -8), 99);
        $women = $this->elimination('Beach Volleyball — Women', 'Nasugbu Sand Court', -5);
        $this->playThrough($women, 1);
        foreach ($this->matchesIn($women, 2) as $k => $semi) {
            $this->move($semi, $t(1), ['09:00', '10:15'][$k] ?? '11:30', 60);
        }
        $this->move($this->finalOf($women), $t(2), '15:00', 60);

        // Sepak takraw and chess: round-robin leagues.
        $this->roundRobin('Sepak Takraw — Men', 'Red Floor Court', -14);
        $this->roundRobin('Sepak Takraw — Women', 'Red Floor Court', -11, leave: 5, liveFirst: true);
        $this->roundRobin('Chess — Men', 'Student Center Hall', -9);
        $this->roundRobin('Chess — Women', 'Student Center Hall', -6);
    }

    /** Badminton and Table Tennis: a single-elimination bracket per line. */
    private function racquetCompetition(): void
    {
        $t = fn (int $days) => $this->today->copy()->addDays($days);

        foreach (['M Singles A' => -13, 'M Singles B' => -12, 'W Singles A' => -11, 'W Singles B' => -10] as $line => $day) {
            $this->playThrough($this->elimination("Badminton — {$line}", 'Badminton Hall', $day, 45), 99);
        }
        $doubles = $this->elimination('Badminton — M Doubles', 'Badminton Hall', -9, 45);
        $this->playThrough($doubles, 2);
        $this->move($this->finalOf($doubles), $t(3), '14:00', 45);
        $this->elimination('Badminton — W Doubles', 'Badminton Hall', 4, 45);   // drawn, not started

        foreach (['M Singles A' => -13, 'M Singles B' => -12, 'W Singles B' => -10, 'M Doubles' => -9, 'W Doubles' => -8] as $line => $day) {
            $this->playThrough($this->elimination("Table Tennis — {$line}", 'Table Tennis Center', $day, 45), 99);
        }
        $singles = $this->elimination('Table Tennis — W Singles A', 'Table Tennis Center', -11, 45);
        $this->playThrough($singles, 2);
        $this->goLiveSets($this->finalOf($singles), 'Table Tennis', 2, 1, [[11, 8], [9, 11], [11, 7]], 'Game 4');
    }

    /**
     * A round-robin league among all seven colleges (21 fixtures over three
     * days), played in full — or all but the last `$leave`, which move to
     * the coming days (the first of them live right now, with `$liveFirst`).
     */
    private function roundRobin(string $sport, string $venue, int $day, int $leave = 0, bool $liveFirst = false): Bracket
    {
        $order = $this->shuffled($this->colleges, $sport);
        $bracket = $this->publish($sport, 'round_robin', $order, $venue, $day, '08:00', 60);

        $fixtures = BracketMatch::where('bracket_id', $bracket->id)->orderBy('round')->orderBy('slot')->get();
        $played = $fixtures->slice(0, $fixtures->count() - $leave);
        foreach ($played as $bm) {
            $this->playMatch($bm, 'group', advance: false);
        }
        $this->brackets->resolve($bracket->fresh('matches'));

        foreach ($fixtures->slice($fixtures->count() - $leave)->values() as $k => $bm) {
            if ($k === 0 && $liveFirst) {
                $this->move($bm, $this->today, now()->subMinutes(35)->format('H:i'), 60);
                $this->goLiveSets($bm->fresh(), explode(' — ', $sport)[0], 1, 0, [[15, 11], [9, 7]], 'Set 2');
            } else {
                $this->move($bm, $this->today->copy()->addDays(1 + intdiv($k, 3)), ['09:00', '10:15', '11:30'][$k % 3], 60);
            }
        }

        return $bracket;
    }

    /** Top-4 playoffs seeded from the group stage: #1 v #4, #2 v #3, then the final. */
    private function playoffs(string $sport, string $venue, int $day, string $time, int $minutes): Bracket
    {
        $top = array_slice(array_column(TeamMatch::standings($sport), 'department'), 0, 4);

        return $this->publish($sport, 'single_elimination', $top, $venue, $day, $time, $minutes, 'standings');
    }

    /** A single-elimination bracket of all seven colleges (one bye). */
    private function elimination(string $sport, string $venue, int $day, int $minutes = 60): Bracket
    {
        return $this->publish($sport, 'single_elimination', $this->shuffled($this->colleges, $sport), $venue, $day, '08:00', $minutes);
    }

    private function publish(string $sport, string $format, array $teams, string $venue, int $day, string $time, int $minutes, string $draw = 'manual'): Bracket
    {
        $bracket = $this->brackets->generate([
            'sport' => $sport, 'format' => $format, 'participants' => $teams, 'drawMethod' => $draw,
            'startDate' => $this->today->copy()->addDays($day)->toDateString(), 'startTime' => $time,
            'matchDuration' => $minutes, 'breakDuration' => 15, 'venueId' => $this->venues[$venue] ?? null,
        ], $this->adminId);

        $result = $this->brackets->publish($bracket);
        if (! empty($result['conflicts'])) {
            throw new \RuntimeException("Couldn't schedule {$bracket->name}: {$venue} is already booked then.");
        }

        foreach (Event::whereIn('id', $bracket->fresh('matches')->matches->pluck('event_id')->filter())->get() as $event) {
            $this->assignJudge($event);
            $this->lineUp($event);
        }

        return $bracket->fresh('matches');
    }

    /** Play every elimination match up to and including round `$through`, in order. */
    private function playThrough(Bracket $bracket, int $through): void
    {
        while ($bm = BracketMatch::where('bracket_id', $bracket->id)->where('is_bye', false)
            ->where('status', '!=', 'completed')->where('round', '<=', $through)
            ->whereNotNull('home_team')->whereNotNull('away_team')->whereNotNull('event_id')
            ->orderBy('round')->orderBy('slot')->first()) {
            $this->playMatch($bm, 'elimination', advance: true);
        }
    }

    private function finalOf(Bracket $bracket): BracketMatch
    {
        return BracketMatch::where('bracket_id', $bracket->id)->orderByDesc('round')->first();
    }

    private function matchesIn(Bracket $bracket, int $round)
    {
        return BracketMatch::where('bracket_id', $bracket->id)->where('round', $round)->orderBy('slot')->get();
    }

    /** Reschedule a match (and its game). */
    private function move(BracketMatch $bm, Carbon $date, string $time, int $minutes): void
    {
        $end = Carbon::parse($time)->addMinutes($minutes)->format('H:i');
        DB::table('bracket_matches')->where('id', $bm->id)->update(['scheduled_date' => $date->toDateString(), 'scheduled_time' => $time]);
        if ($bm->event_id) {
            DB::table('events')->where('id', $bm->event_id)->update(['schedule' => $date->toDateString(), 'start_time' => $time, 'end_time' => $end]);
        }
    }

    // ── Results ─────────────────────────────────────────────────────────

    /**
     * Record one game the way the scorers do: a final live score and the
     * head-to-head result, the game completed, and (elimination) the bracket
     * advanced — which also carries lineups into the next game.
     */
    private function playMatch(BracketMatch $bm, string $stage, bool $advance): void
    {
        $event = Event::find($bm->event_id);
        $this->lineUp($event, onlyMissing: true);   // e.g. a team coming off a bye
        $sport = $this->parentSport($event->category);
        $homeWins = $this->homeWins($event->category, $bm->home_team, $bm->away_team);

        [$home, $away, $detail, $period] = match ($sport) {
            'Basketball' => $this->basketball($event, $homeWins),
            'Volleyball' => $this->volleyball($event, $homeWins),
            default => $this->setsGame($sport, $homeWins),
        };

        $start = Carbon::parse(substr((string) $event->schedule, 0, 10).' '.$event->start_time);
        $judge = $event->judges[0]['id'] ?? $this->judges[0]->id;
        DB::table('live_scores')->insert([
            'id' => (string) Str::uuid(), 'event_id' => $event->id, 'sport' => $event->category,
            'home_team' => $bm->home_team, 'away_team' => $bm->away_team,
            'home_score' => $home, 'away_score' => $away, 'period' => $period, 'current_period' => $detail['current'] ?? null,
            'detail' => json_encode($detail['detail'] ?? []), 'status' => 'final', 'version' => $detail['version'] ?? 1,
            'updated_by' => $judge, 'started_at' => $start, 'finalized_at' => $start->copy()->addMinutes(80),
            'created_at' => $start, 'updated_at' => $start->copy()->addMinutes(80),
        ]);
        DB::table('team_matches')->insert([
            'id' => (string) Str::uuid(), 'sport' => $event->category, 'stage' => $stage, 'event_id' => $event->id,
            'home_team' => $bm->home_team, 'away_team' => $bm->away_team, 'home_score' => $home, 'away_score' => $away,
            'winner' => $home > $away ? $bm->home_team : $bm->away_team, 'is_draw' => false, 'status' => 'completed',
            'played_at' => $start->copy()->addMinutes(80), 'recorded_by' => $judge,
            'created_at' => $start, 'updated_at' => $start,
        ]);
        DB::table('events')->where('id', $event->id)->update(['status' => 'completed']);

        if ($advance) {
            $this->brackets->advanceFromEvent($event->id);
        } else {
            $winner = $home > $away ? $bm->home_team : $bm->away_team;
            DB::table('bracket_matches')->where('id', $bm->id)->update([
                'winner' => $winner, 'loser' => $winner === $bm->home_team ? $bm->away_team : $bm->home_team, 'status' => 'completed',
            ]);
        }
    }

    /** Each college has a steady strength per sport, so results form believable standings. */
    private function homeWins(string $sport, string $home, string $away): bool
    {
        foreach ([$home, $away] as $c) {
            $this->strength[$sport][$c] ??= mt_rand(40, 100);
        }
        $h = $this->strength[$sport][$home];
        $a = $this->strength[$sport][$away];

        return mt_rand(1, 1000) <= (int) (1000 * $h / ($h + $a));
    }

    /**
     * A basketball game with full play-by-play: every basket, free throw and
     * foul by the lineups' players, quarter by quarter, adding up exactly to
     * the final score. `$upTo` stops after that quarter (a game still live).
     */
    private function basketball(Event $event, bool $homeWins, ?int $upTo = null): array
    {
        $teams = PlayByPlay::teams($event);
        $w = mt_rand(62, 96);
        $l = $w - mt_rand(2, 21);
        $scores = $homeWins ? [$w, $l] : [$l, $w];
        $judge = $event->judges[0]['id'] ?? null;
        $clock = Carbon::parse(substr((string) $event->schedule, 0, 10).' '.$event->start_time);
        $quarters = [[], []];
        $fouls = [];
        $stats = [];
        $rows = [];

        $rosters = [];
        foreach ($teams as $i => $team) {
            $rosters[$i] = GamePlayer::where('game_id', $event->id)->where('team_id', $team->id)
                ->orderByRaw('CAST(jersey_number AS UNSIGNED)')->pluck('player_id')->all();
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
            shuffle($quarterPlays);
            foreach ($quarterPlays as [$teamId, $playerId, $type]) {
                $clock->addSeconds(mt_rand(15, 50));
                $rows[] = $this->playRow($event->id, $teamId, $playerId, $type, $q, $judge, $clock);
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

    /**
     * A volleyball match, best of three, rally by rally: set starts with the
     * lineups' rotations, serve and rotation tracked exactly as the scorer
     * replays them (a side-out rotates the team; an ace is the server's).
     */
    private function volleyball(Event $event, bool $homeWins): array
    {
        $teams = PlayByPlay::teams($event);
        $judge = $event->judges[0]['id'] ?? null;
        $clock = Carbon::parse(substr((string) $event->schedule, 0, 10).' '.$event->start_time);
        $ids = [$teams[0]->id, $teams[1]->id];
        $starting = [];
        foreach ($ids as $i => $id) {
            $rot = GamePlayer::where('game_id', $event->id)->where('team_id', $id)->whereNotNull('rotation_position')
                ->orderBy('rotation_position')->pluck('player_id')->all();
            $starting[$i] = count($rot) === 6 ? $rot : null;
        }

        // Which sets each side wins: the winner takes two.
        $winner = $homeWins ? 0 : 1;
        $setWinners = mt_rand(1, 100) <= 45 ? [$winner, 1 - $winner, $winner] : [$winner, $winner];
        if (count($setWinners) === 3 && mt_rand(0, 1)) {
            $setWinners = [1 - $winner, $winner, $winner];
        }

        $rows = [];
        $sets = [];
        $stats = [];
        $firstServer = mt_rand(0, 1);
        foreach ($setWinners as $s => $sw) {
            $target = $s === 2 ? 15 : 25;
            $sequence = $this->rallySequence($sw, $target);
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

        $this->performanceFrom($event, 'Volleyball', $stats, fn ($s) => [
            'kills' => $s['KILL'] ?? 0, 'aces' => $s['ACE'] ?? 0, 'blocks' => $s['BLOCK'] ?? 0,
            'points' => ($s['KILL'] ?? 0) + ($s['ACE'] ?? 0) + ($s['BLOCK'] ?? 0),
        ], 'points');

        $won = [count(array_filter($setWinners, fn ($x) => $x === 0)), count(array_filter($setWinners, fn ($x) => $x === 1))];
        $last = end($sets);

        return [$won[0], $won[1], [
            'current' => count($sets), 'version' => count($rows),
            'detail' => ['bestOf' => 3, 'sets' => $sets],
        ], 'Set '.count($sets).' · '.$last[0].'–'.$last[1]];
    }

    /**
     * Who wins each rally of a set that `$winner` takes: nobody reaches the
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

    /** Set-based sports without play-by-play: the sets (or boards) and the final. */
    private function setsGame(string $sport, bool $homeWins): array
    {
        [$bestOf, $target, $decider, $label] = match ($sport) {
            'Beach Volleyball' => [3, 21, 15, 'Set'],
            'Sepak Takraw' => [3, 15, 15, 'Set'],
            'Badminton' => [3, 21, 21, 'Game'],
            'Table Tennis' => [5, 11, 11, 'Game'],
            default => [0, 0, 0, 'Board'],   // chess
        };

        if ($sport === 'Chess') {
            [$w, $l] = mt_rand(1, 100) <= 25 ? [4, 0] : [3, 1];

            return [...($homeWins ? [$w, $l] : [$l, $w]), ['detail' => ['boards' => 4]], 'Final'];
        }

        $need = intdiv($bestOf, 2) + 1;
        $lost = mt_rand(0, $need - 1);
        $order = [...array_fill(0, $lost, 1), ...array_fill(0, $need - 1, 0)];
        shuffle($order);
        $order[] = 0;   // the winner takes the last one
        $sets = [];
        foreach ($order as $k => $who) {
            $t = $k === $bestOf - 1 ? $decider : $target;
            $pts = [$t, mt_rand((int) ($t * 0.4), $t - 2)];
            $winnerSide = $homeWins ? $who : 1 - $who;
            $sets[] = $winnerSide === 0 ? $pts : array_reverse($pts);
        }
        $scores = $homeWins ? [$need, $lost] : [$lost, $need];

        return [$scores[0], $scores[1], ['detail' => ['bestOf' => $bestOf, 'sets' => $sets]], $label.' '.count($sets)];
    }

    // ── Live now ────────────────────────────────────────────────────────

    /** A basketball final in its third quarter right now, with the play-by-play so far. */
    private function goLiveBasketball(BracketMatch $final): void
    {
        $start = now()->subMinutes(70);
        $this->move($final, $this->today, $start->format('H:i'), 90);
        $event = Event::find($final->event_id);
        DB::table('events')->where('id', $event->id)->update(['status' => 'ongoing']);

        [$home, $away, $meta] = $this->basketball($event, $this->homeWins($event->category, $final->home_team, $final->away_team), upTo: 3);
        DB::table('live_scores')->insert([
            'id' => (string) Str::uuid(), 'event_id' => $event->id, 'sport' => $event->category,
            'home_team' => $final->home_team, 'away_team' => $final->away_team,
            'home_score' => $home, 'away_score' => $away, 'period' => 'Q3', 'current_period' => 3,
            'detail' => json_encode([]), 'status' => 'in_progress', 'version' => $meta['version'],
            'updated_by' => $event->judges[0]['id'] ?? null, 'started_at' => $start,
            'created_at' => $start, 'updated_at' => now(),
        ]);
    }

    /** A set-based game in progress right now (manual scoreboard). */
    private function goLiveSets(BracketMatch $bm, string $sport, int $home, int $away, array $sets, string $period): void
    {
        if (! $bm->event_id || ! $bm->home_team || ! $bm->away_team) {
            return;
        }
        $start = now()->subMinutes(35);
        $this->move($bm, $this->today, $start->format('H:i'), 60);
        DB::table('events')->where('id', $bm->event_id)->update(['status' => 'ongoing']);
        DB::table('live_scores')->insert([
            'id' => (string) Str::uuid(), 'event_id' => $bm->event_id, 'sport' => DB::table('events')->where('id', $bm->event_id)->value('category'),
            'home_team' => $bm->home_team, 'away_team' => $bm->away_team,
            'home_score' => $home, 'away_score' => $away, 'period' => $period,
            'detail' => json_encode(['sets' => $sets]), 'status' => 'in_progress', 'version' => 9,
            'updated_by' => $this->judges[0]->id, 'started_at' => $start, 'created_at' => $start, 'updated_at' => now(),
        ]);
    }

    // ── Friendlies ──────────────────────────────────────────────────────

    /** A few upcoming friendlies between colleges, across sports and venues. */
    private function friendlies(): void
    {
        $games = [
            ['Basketball — Women', 'CAS', 'LS', 'ARASOF Covered Court', 3, '09:00'],
            ['Volleyball — Men', 'CCJE', 'CONAHS', 'Joson Gymnasium', 4, '10:00'],
            ['Sepak Takraw — Men', 'CICS', 'CTE', 'Red Floor Court', 5, '14:00'],
            ['Chess — Women', 'CABEIHM', 'LS', 'Student Center Hall', 5, '13:00'],
            ['Beach Volleyball — Men', 'CONAHS', 'CAS', 'Nasugbu Sand Court', 6, '08:00'],
            ['Basketball — Men', 'CICS', 'CCJE', 'Joson Gymnasium', 7, '16:00'],
        ];
        $names = TournamentResetSeeder::COLLEGES;
        foreach ($games as [$sport, $a, $b, $venue, $day, $time]) {
            [$parent, $division] = explode(' — ', $sport);
            $event = Event::create([
                'id' => (string) Str::uuid(),
                'name' => "{$division}'s {$parent} Friendly: {$a} vs {$b}",
                'category' => $sport,
                'schedule' => $this->today->copy()->addDays($day)->toDateString(),
                'start_time' => $time,
                'end_time' => Carbon::parse($time)->addMinutes(90)->format('H:i'),
                'venue_id' => $this->venues[$venue] ?? null,
                'venue_name' => $venue,
                'departments' => [$names[$a], $names[$b]],
                'status' => 'upcoming',
                'qr_token' => Str::random(32),
            ]);
            $this->assignJudge($event);
            $this->lineUp($event);
        }
    }

    // ── Lineups, judges, racquet lines ──────────────────────────────────

    private function assignJudge(Event $event): void
    {
        $j = $this->judges[$this->judgeTurn++ % count($this->judges)];
        DB::table('events')->where('id', $event->id)->update(['judges' => json_encode([['id' => $j->id, 'name' => $j->name, 'email' => $j->email]])]);
        $event->judges = [['id' => $j->id, 'name' => $j->name, 'email' => $j->email]];
    }

    /**
     * Both colleges' lineups for a game whose teams are known, from each
     * college's coach for the division — with the sport's positions (the
     * volleyball rotation, the sepak takraw regu, chess boards).
     */
    /**
     * A team that got a round-one bye has no earlier game to carry a lineup
     * from: fill it in for every game still to play.
     */
    private function lineUpByes(): void
    {
        foreach (Event::where('status', '!=', 'completed')->get() as $event) {
            if (count($event->departments ?? []) === 2) {
                $this->lineUp($event, onlyMissing: true);
            }
        }
    }

    private function lineUp(Event $event, bool $onlyMissing = false): void
    {
        $sport = LineupRules::sportOf($event);
        $teams = $sport ? PlayByPlay::teams($event) : null;
        if (! $teams) {
            return;
        }
        $rules = LineupRules::for($sport);
        $division = PlayByPlay::divisionOf($event) ?? 'Men';
        $starters = ['basketball' => 5, 'beach volleyball' => 2][$sport] ?? count($rules['positions']);
        $rows = [];

        foreach ($teams as $team) {
            if ($onlyMissing && GamePlayer::where('game_id', $event->id)->where('team_id', $team->id)->exists()) {
                continue;
            }
            $coach = $this->coaches[$team->name][$division] ?? null;
            if (! $coach) {
                continue;
            }
            $players = collect($this->athletes)
                ->filter(fn ($a) => $a->coach_id === $coach->id && mb_strtolower($a->sport) === $sport)
                ->sortBy(fn ($a) => (int) $a->jersey_number)
                ->take(min($rules['max'], TournamentResetSeeder::PER_TEAM))
                ->values();
            foreach ($players as $k => $a) {
                $rows[] = [
                    'game_id' => $event->id, 'team_id' => $team->id, 'player_id' => $a->id,
                    'jersey_number' => $a->jersey_number,
                    'rotation_position' => $k < count($rules['positions']) ? $k + 1 : null,
                    'is_starter' => $k < $starters, 'created_at' => now(), 'updated_at' => now(),
                ];
            }
        }
        DB::table('game_players')->insert($rows);
    }

    /** Every coach's racquet lines: Singles A, Singles B and a Doubles pair per racquet sport. */
    private function racquetLines(): void
    {
        $rows = [];
        foreach ($this->coaches as $college => $pair) {
            foreach (['Men' => 'M', 'Women' => 'W'] as $division => $g) {
                $coach = $pair[$division];
                foreach (['Badminton', 'Table Tennis'] as $sport) {
                    $players = collect($this->athletes)->filter(fn ($a) => $a->coach_id === $coach->id && $a->sport === $sport)
                        ->sortBy(fn ($a) => (int) $a->jersey_number)->take(4)->values();
                    foreach ([['Singles A', null], ['Singles B', null], ['Doubles', 'C'], ['Doubles', 'D']] as $k => [$line, $slot]) {
                        if ($a = $players[$k] ?? null) {
                            $rows[] = [
                                'id' => (string) Str::uuid(), 'category' => "{$sport} — {$g} {$line}", 'department' => $college,
                                'athlete_id' => $a->id, 'athlete_name' => "{$a->first_name} {$a->last_name}",
                                'coach_id' => $coach->id, 'pair_slot' => $slot,
                                'created_at' => now()->subDays(20), 'updated_at' => now()->subDays(20),
                            ];
                        }
                    }
                }
            }
        }
        DB::table('discipline_entries')->insert($rows);
    }

    // ── Everyday records ────────────────────────────────────────────────

    private function everydayRecords(): void
    {
        $this->announcementsAndTryouts();
        $this->attendance();
        $this->requirements();
        $this->appeals();
        $this->committeeNotifications();
        RankingController::forgetLeaderboardCacheFor('Basketball', DB::table('seasons')->where('is_active', true)->value('id'));
    }

    private function announcementsAndTryouts(): void
    {
        $sports = array_keys(TournamentResetSeeder::SPORTS);
        $venueFor = fn (string $sport) => collect(TournamentResetSeeder::VENUES)->search(fn ($v) => in_array($sport, $v[2], true)) ?: 'Joson Gymnasium';
        $n = 0;
        foreach ($this->coaches as $college => $pair) {
            foreach ($pair as $division => $coach) {
                $n++;
                $abbr = $this->abbr[$college];
                $sport = $sports[$n % count($sports)];
                $tryoutId = (string) Str::uuid();
                $tryoutDay = $this->today->copy()->addDays(2 + $n % 6);
                $rows = [
                    [$tryoutId, "{$division}'s {$sport} Tryouts — {$abbr}",
                        "Open to all {$abbr} students. Bring your PE uniform and a copy of your COR. Walk-ins welcome; pre-register below so we can plan the drills.",
                        true, $sport, 14 - $n % 7, $tryoutDay, '16:00', '18:00', $venueFor($sport)],
                    [(string) Str::uuid(), 'Training schedule this week',
                        "{$division}'s teams train Monday, Wednesday and Friday, 4:00–6:00 PM. Conditioning on Saturday morning. Be on time for the warm-up.",
                        false, 'Basketball', 6 + $n % 4, null, null, null, null],
                    [(string) Str::uuid(), 'Submit your eligibility requirements',
                        'Players without an approved Medical Clearance and Certificate of Enrollment cannot be listed on a game lineup. Upload them under Requirements.',
                        false, $sport, 2 + $n % 3, null, null, null, null],
                ];
                foreach ($rows as [$id, $title, $content, $tryout, $s, $days, $date, $start, $end, $venue]) {
                    DB::table('announcements')->insert([
                        'id' => $id, 'title' => $title, 'content' => $content, 'is_tryout' => $tryout,
                        'tryout_date' => $date?->toDateString(), 'tryout_start_time' => $start, 'tryout_end_time' => $end, 'tryout_venue' => $venue,
                        'sport' => $s, 'coach_id' => $coach->id, 'coach_name' => $coach->name,
                        'created_at' => now()->subDays($days), 'updated_at' => now()->subDays($days),
                    ]);
                }

                // Applicants from the coach's own college.
                foreach (['pending', 'pending', 'accepted', 'rejected'] as $k => $status) {
                    $female = $division === 'Women';
                    $first = ($female ? ['Alyssa', 'Joy', 'Pia', 'Rhea'] : ['Ian', 'Leo', 'Nash', 'Troy'])[$k];
                    $last = ['Mercado', 'Pineda', 'Robles', 'Soriano'][($k + $n) % 4];
                    $sr = sprintf('25-%05d', 80000 + $n * 10 + $k);
                    $email = $sr.TournamentResetSeeder::DOMAIN;
                    DB::table('campus_students')->insertOrIgnore([
                        'sr_code' => $sr, 'first_name' => $first, 'last_name' => $last, 'gender' => $female ? 'Female' : 'Male',
                        'college' => $college, 'program' => 'BS Test Program', 'year_level' => '1st Year', 'email' => $email,
                        'created_at' => now(), 'updated_at' => now(),
                    ]);
                    $applied = now()->subDays(1 + $k * 2);
                    DB::table('tryout_applications')->insert([
                        'id' => (string) Str::uuid(), 'announcement_id' => $tryoutId, 'sport' => $sport,
                        'coach_id' => $coach->id, 'first_name' => $first, 'last_name' => $last, 'email' => $email,
                        'student_id' => $sr, 'department' => $college, 'phone' => sprintf('09%09d', 170000000 + $n * 10 + $k),
                        'year_level' => '1st Year', 'status' => $status,
                        'reviewed_by' => $status === 'pending' ? null : $coach->id,
                        'reviewed_at' => $status === 'pending' ? null : $applied->copy()->addDay(),
                        'review_note' => $status === 'rejected' ? 'Roster is full this season — try again next semester.' : null,
                        'applied_at' => $applied, 'created_at' => $applied, 'updated_at' => $applied,
                    ]);
                }
            }
        }
    }

    /** Four training sessions per coach over the past two weeks, everyone marked. */
    private function attendance(): void
    {
        $pattern = ['present', 'present', 'present', 'late', 'present', 'excused', 'present', 'absent', 'present', 'present', 'present', 'late'];
        $records = [];
        foreach ($this->coaches as $pair) {
            foreach ($pair as $coach) {
                $roster = collect($this->athletes)->where('coach_id', $coach->id)->values();
                foreach ([3, 6, 9, 12] as $s => $ago) {
                    $date = $this->today->copy()->subDays($ago)->toDateString();
                    $sid = (string) Str::uuid();
                    DB::table('attendance_sessions')->insert([
                        'id' => $sid, 'coach_id' => $coach->id, 'title' => ['Training', 'Conditioning', 'Tactical session', 'Scrimmage'][$s],
                        'date' => $date, 'start_time' => '16:00', 'end_time' => '18:00', 'venue_name' => 'Joson Gymnasium',
                        'created_by' => $coach->id, 'created_at' => $date, 'updated_at' => $date,
                    ]);
                    foreach ($roster as $k => $a) {
                        $records[] = [
                            'id' => (string) Str::uuid(), 'session_id' => $sid, 'athlete_id' => $a->id, 'event_id' => 'training',
                            'session_label' => null, 'date' => $date, 'status' => $pattern[($k + $s * 5) % count($pattern)], 'notes' => null,
                            'recorded_by' => $coach->id, 'recorded_at' => $date.' 18:05:00', 'created_at' => $date, 'updated_at' => $date,
                        ];
                    }
                }
            }
        }
        foreach (array_chunk($records, 400) as $chunk) {
            DB::table('attendance_records')->insert($chunk);
        }
    }

    /** Every athlete's eligibility checklist, at every stage. */
    private function requirements(): void
    {
        $path = 'requirements/samples/sample-document.pdf';
        Storage::disk('public')->put($path, $this->samplePdf());
        $url = Storage::url($path);
        $types = DB::table('requirement_types')->pluck('id', 'name');
        $states = [
            ['Waiver Form' => 'approved', 'Certificate of Enrollment' => 'approved', 'Medical Clearance' => 'approved', 'Parental Consent' => 'approved'],
            ['Waiver Form' => 'approved', 'Certificate of Enrollment' => 'approved', 'Medical Clearance' => 'pending'],
            ['Waiver Form' => 'approved', 'Certificate of Enrollment' => 'approved', 'Medical Clearance' => 'approved'],
            ['Waiver Form' => 'pending', 'Certificate of Enrollment' => 'rejected'],
            ['Waiver Form' => 'approved', 'Certificate of Enrollment' => 'approved', 'Medical Clearance' => 'rejected'],
            ['Certificate of Enrollment' => 'pending'],
        ];
        $notes = [
            'Certificate of Enrollment' => 'This is last semester\'s COR — please upload the current one.',
            'Medical Clearance' => 'Missing the physician\'s signature and license number.',
        ];
        $rows = [];
        $k = 0;
        foreach ($this->athletes as $a) {
            foreach ($states[$k % count($states)] as $name => $status) {
                $at = now()->subDays(12 - $k % 9);
                $rows[] = [
                    'id' => (string) Str::uuid(), 'athlete_id' => $a->id, 'athlete_name' => "{$a->first_name} {$a->last_name}",
                    'type' => 'checklist', 'requirement_type_id' => $types[$name] ?? null, 'supersedes_id' => null,
                    'name' => $name, 'description' => null, 'file_url' => $url, 'status' => $status,
                    'notes' => $status === 'rejected' ? ($notes[$name] ?? 'Unreadable scan — please resubmit.') : null,
                    'reviewed_by' => $status === 'pending' ? null : $a->coach_id,
                    'reviewed_at' => $status === 'pending' ? null : $at->copy()->addDay(),
                    'submitted_at' => $at, 'created_at' => $at, 'updated_at' => $at,
                ];
            }
            $k++;
        }
        foreach (array_chunk($rows, 400) as $chunk) {
            DB::table('requirements')->insert($chunk);
        }
    }

    /** Appeals on played games, filed by the losing side, at every stage. */
    private function appeals(): void
    {
        $season = DB::table('seasons')->where('is_active', true)->value('id');
        $played = DB::table('team_matches')->where('stage', 'group')->where('sport', 'like', 'Basketball%')
            ->orderBy('played_at')->limit(3)->get()
            ->merge(DB::table('team_matches')->where('stage', 'group')->where('sport', 'like', 'Volleyball%')->orderBy('played_at')->limit(3)->get());
        $cases = [
            ['open', 'The shot clock was not reset after an offensive rebound with 1:12 left in the 4th quarter; the resulting possession decided the game.', null],
            ['dismissed', 'An ineligible player (no approved clearance) was fielded in the 2nd half.', 'Records show the player was cleared before the game. Result stands.'],
            ['upheld', 'A foul was charged to the wrong jersey, fouling our player out.', 'Confirmed from the scoresheet: the foul was charged to #12, not #4. Box score corrected; result stands.'],
            ['open', 'The second set was scored 25–23 but the net touch on set point was never called.', null],
            ['dismissed', 'The rotation was out of order on the final rally.', 'The committee\'s rotation record shows it was correct.'],
            ['dismissed', 'Match started 20 minutes early without our libero present.', 'Start time was on the published schedule. Result stands.'],
        ];
        foreach ($played->values() as $k => $match) {
            [$status, $reason, $resolution] = $cases[$k] ?? $cases[0];
            $loser = $match->winner === $match->home_team ? $match->away_team : $match->home_team;
            $division = str_contains($match->sport, 'Women') ? 'Women' : 'Men';
            $coach = $this->coaches[$loser][$division] ?? null;
            if (! $coach) {
                continue;
            }
            $filed = Carbon::parse($match->played_at)->addHours(3);
            DB::table('protests')->insert([
                'id' => (string) Str::uuid(), 'event_id' => $match->event_id, 'season_id' => $season, 'filed_by' => $coach->id,
                'department' => $loser, 'reason' => $reason, 'status' => $status, 'resolution' => $resolution,
                'resolved_by' => $status === 'open' ? null : $this->adminId,
                'resolved_at' => $status === 'open' ? null : $filed->copy()->addDay(),
                'created_at' => $filed, 'updated_at' => $filed,
            ]);
            $this->notify($this->adminId, 'ProtestFiled', 'protest_filed', 'New appeal', "{$this->abbr[$loser]} appealed a {$match->sport} result.", '/admin/protests', $filed, $status !== 'open');
            if ($status !== 'open') {
                $this->notify($coach->id, 'ProtestResolved', 'protest_resolved', 'Appeal '.$status, "Your appeal about {$match->sport} was {$status}.", '/coach/protests', $filed->copy()->addDay(), false);
            }
        }
    }

    /** Each judge is told about the upcoming games they're assigned to score. */
    private function committeeNotifications(): void
    {
        $upcoming = Event::whereIn('status', ['upcoming', 'ongoing'])->whereNotNull('judges')->get();
        foreach ($upcoming as $k => $event) {
            $judge = $event->judges[0]['id'] ?? null;
            if ($judge && $k < 60) {
                $this->notify($judge, 'CommitteeAssigned', 'committee_assigned', 'Assigned to score '.$event->name,
                    'Tap to open the score sheet. The QR code was also emailed to you.', EventQr::path($event), now()->subDays(2), $k % 3 === 0);
            }
        }
    }

    private function notify(string $userId, string $class, string $kind, string $title, string $body, string $url, Carbon $at, bool $read): void
    {
        DB::table('notifications')->insert([
            'id' => (string) Str::uuid(), 'type' => 'App\\Notifications\\'.$class, 'notifiable_type' => 'App\\Models\\User',
            'notifiable_id' => $userId, 'data' => json_encode(['kind' => $kind, 'title' => $title, 'body' => $body, 'url' => $url]),
            'read_at' => $read ? $at->copy()->addHours(2) : null, 'created_at' => $at, 'updated_at' => $at,
        ]);
    }

    // ── Helpers ─────────────────────────────────────────────────────────

    /** Plays and performance notes, written in batches. */
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

    private function playRow(string $gameId, string $teamId, ?string $playerId, string $type, int $period, ?string $judge, Carbon $at): array
    {
        return [
            'game_id' => $gameId, 'team_id' => $teamId, 'player_id' => $playerId, 'player_out_id' => null,
            'type' => $type, 'period' => $period, 'game_clock' => null, 'detail' => null, 'recorded_by' => $judge,
            'created_at' => $at->copy(), 'updated_at' => $at->copy(), 'deleted_at' => null,
        ];
    }

    /** Performance notes for everyone who figured in a game's play-by-play. */
    private function performanceFrom(Event $event, string $sport, array $stats, callable $metrics, string $key): void
    {
        $at = Carbon::parse(substr((string) $event->schedule, 0, 10).' 20:00');
        foreach ($stats as $playerId => $s) {
            $a = $this->athletes[$playerId] ?? null;
            if (! $a) {
                continue;
            }
            $m = $metrics($s);
            $rating = max(5, min(10, 5 + intdiv($m[$key], $sport === 'Basketball' ? 4 : 3)));
            $notes = self::NOTES[$sport];
            $this->performance[] = [
                'id' => (string) Str::uuid(), 'athlete_id' => $a->id, 'athlete_name' => "{$a->first_name} {$a->last_name}",
                'event_id' => $event->id, 'event_name' => $event->name, 'sport' => $sport,
                'metrics' => json_encode($m), 'overall_rating' => $rating, 'coach_notes' => $notes[crc32($playerId.$event->id) % count($notes)],
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

    /** The same list in a different, repeatable order per sport — so draws vary. */
    private function shuffled(array $items, string $seed): array
    {
        usort($items, fn ($a, $b) => crc32($seed.$a) <=> crc32($seed.$b));

        return $items;
    }

    private function parentSport(string $category): string
    {
        foreach (array_keys(TournamentResetSeeder::SPORTS) as $sport) {
            if (str_starts_with($category, $sport.' ')) {
                return $sport;
            }
        }

        return $category;
    }

    /** A tiny valid one-page PDF so "View file" links open something real. */
    private function samplePdf(): string
    {
        $text = 'SportAxis - sample requirement upload';
        $stream = "BT /F1 18 Tf 72 720 Td ({$text}) Tj ET";
        $objs = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
            '<< /Length '.strlen($stream)." >>\nstream\n{$stream}\nendstream",
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        ];
        $out = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objs as $i => $obj) {
            $offsets[] = strlen($out);
            $out .= ($i + 1)." 0 obj\n{$obj}\nendobj\n";
        }
        $xref = strlen($out);
        $out .= 'xref'."\n0 ".(count($objs) + 1)."\n0000000000 65535 f \n";
        foreach ($offsets as $o) {
            $out .= sprintf("%010d 00000 n \n", $o);
        }

        return $out.'trailer << /Size '.(count($objs) + 1)." /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";
    }
}
