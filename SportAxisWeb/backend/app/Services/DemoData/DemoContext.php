<?php

namespace App\Services\DemoData;

use Faker\Factory as FakerFactory;
use Faker\Generator as Faker;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Everything the demo seeders share: the fixed spec (colleges, sports,
 * rosters, venues, judges), a Faker seeded with 2026 so every run is the
 * same, and lookups loaded from the database so each seeder can also run
 * on its own after the ones before it.
 *
 * Teams are colleges. A college fields a team in every sport's Men's and
 * Women's division (98 teams). Each college has a coach per sport who runs
 * both its Men's and its Women's team ("Men & Women"): 7 × 7 = 49 coaches.
 * A team's roster is its coach's athletes of that division.
 */
class DemoContext
{
    public const PASSWORD = 'demo123';

    public const DOMAIN = '@g.batstate-u.edu.ph';

    public const PRIVACY_NOTICE_VERSION = '2026-09-21';

    public const SEASON = 'BatStateU Intramurals 2026';

    public const PREVIOUS_SEASON = 'BatStateU Intramurals 2025';

    public const SEED = 2026;

    /** abbreviation => name, in this order. */
    public const COLLEGES = [
        'CABEIHM' => 'College of Accountancy, Business, Economics, and International Hospitality Management',
        'CICS' => 'College of Informatics and Computing Sciences',
        'CTE' => 'College of Teacher Education',
        'CONAHS' => 'College of Nursing and Allied Health Sciences',
        'CCJE' => 'College of Criminal Justice Education',
        'CAS' => 'College of Arts and Sciences',
        'LS' => 'Laboratory School',
    ];

    /** Other spellings an existing college row might use. */
    public const ALIASES = [
        'CONAHS' => ['CONHAS'],
        'LS' => ['LAB', 'LABSCHOOL'],
    ];

    /** name => description. */
    public const SPORTS = [
        'Basketball' => 'Five-a-side basketball, FIBA rules, four 10-minute quarters.',
        'Volleyball' => 'Indoor volleyball, best of five sets.',
        'Beach Volleyball' => 'Beach volleyball pairs, best of three sets.',
        'Sepak Takraw' => 'Regu competition, best of three sets to 21.',
        'Badminton' => 'Singles and doubles lines, best of three games to 21.',
        'Table Tennis' => 'Singles and doubles lines, best of five games to 11.',
        'Chess' => 'Four-board team chess, rapid time control.',
    ];

    /** Played in Men's and Women's divisions ("Basketball — Men"). */
    public const DIVISION_SPORTS = ['Basketball', 'Volleyball', 'Beach Volleyball', 'Sepak Takraw', 'Chess'];

    /** Played per line ("Badminton — M Singles A"), Men's and Women's. */
    public const RACQUET_SPORTS = ['Badminton', 'Table Tennis'];

    public const LINES = ['Singles A', 'Singles B', 'Doubles'];

    /** Players per team. */
    public const ROSTER = [
        'Basketball' => 12, 'Volleyball' => 12, 'Beach Volleyball' => 3, 'Sepak Takraw' => 5,
        'Badminton' => 4, 'Table Tennis' => 4, 'Chess' => 5,
    ];

    /** Short sport codes, for coaches' enrollment codes. */
    public const SPORT_CODE = [
        'Basketball' => 'BB', 'Volleyball' => 'VB', 'Beach Volleyball' => 'BV', 'Sepak Takraw' => 'ST',
        'Badminton' => 'BD', 'Table Tennis' => 'TT', 'Chess' => 'CH',
    ];

    /** name => [type, capacity, sports, location, facilities]. */
    public const VENUES = [
        'University Gymnasium' => ['Gymnasium', 1500, ['Basketball', 'Volleyball'], 'Main Campus, beside the Administration Building', 'Two hardwood courts, electronic scoreboard, shot clocks, bleachers, sound system'],
        'Covered Court A' => ['Covered Court', 800, ['Basketball', 'Volleyball'], 'Main Campus, near the Student Center', 'Rubberized court, bleachers on two sides, LED floodlights'],
        'Covered Court B' => ['Covered Court', 600, ['Volleyball', 'Basketball', 'Sepak Takraw'], 'Main Campus, behind the CTE Building', 'Multi-line court, removable net posts, portable scoreboard'],
        'Beach Volleyball Sand Court' => ['Outdoor Court', 300, ['Beach Volleyball'], 'Sports Complex, east grounds', 'Two regulation sand courts, shaded bleachers, rinse station'],
        'Multi-Purpose Hall' => ['Indoor Hall', 400, ['Sepak Takraw'], 'Sports Complex, ground floor', 'Regulation takraw court, 1.52 m net, scoreboard'],
        'Badminton Hall — Court 1' => ['Badminton Court', 60, ['Badminton'], 'Sports Complex, Badminton Hall (2nd floor)', 'Synthetic mat, umpire chair, service judge seat'],
        'Badminton Hall — Court 2' => ['Badminton Court', 60, ['Badminton'], 'Sports Complex, Badminton Hall (2nd floor)', 'Synthetic mat, umpire chair, service judge seat'],
        'Badminton Hall — Court 3' => ['Badminton Court', 60, ['Badminton'], 'Sports Complex, Badminton Hall (2nd floor)', 'Synthetic mat, umpire chair, service judge seat'],
        'Badminton Hall — Court 4' => ['Badminton Court', 60, ['Badminton'], 'Sports Complex, Badminton Hall (2nd floor)', 'Synthetic mat, umpire chair; warm-up court on match days'],
        'Table Tennis Room — Table 1' => ['Table Tennis Table', 30, ['Table Tennis'], 'Student Center, Room 204', 'ITTF-approved table, barriers, flip scoreboard'],
        'Table Tennis Room — Table 2' => ['Table Tennis Table', 30, ['Table Tennis'], 'Student Center, Room 204', 'ITTF-approved table, barriers, flip scoreboard'],
        'Table Tennis Room — Table 3' => ['Table Tennis Table', 30, ['Table Tennis'], 'Student Center, Room 204', 'ITTF-approved table, barriers, flip scoreboard'],
        'Table Tennis Room — Table 4' => ['Table Tennis Table', 30, ['Table Tennis'], 'Student Center, Room 204', 'ITTF-approved table, barriers; practice table on match days'],
        'Chess Room (Library Function Hall)' => ['Function Hall', 120, ['Chess'], 'University Library, 3rd floor', 'Twelve tournament tables, digital clocks, demo board, quiet zone'],
    ];

    /** judge number => the sports they officiate first (anyone free covers the rest). */
    public const JUDGE_SPORTS = [
        1 => ['Basketball', 'Volleyball'],
        2 => ['Basketball'],
        3 => ['Volleyball', 'Beach Volleyball'],
        4 => ['Beach Volleyball', 'Sepak Takraw'],
        5 => ['Sepak Takraw', 'Chess'],
        6 => ['Badminton'],
        7 => ['Badminton', 'Table Tennis'],
        8 => ['Table Tennis'],
        9 => ['Chess', 'Table Tennis', 'Badminton'],
        10 => ['Basketball', 'Volleyball', 'Sepak Takraw'],
    ];

    public const JUDGE_NAMES = [
        'Liza Mendoza', 'Arnold Panganiban', 'Grace Umali', 'Ronald Magpantay', 'Sheila Katigbak',
        'Victor Comia', 'Rowena Lualhati', 'Edgar De Castro', 'Maricel Aguilar', 'Noel Perez',
    ];

    public const PROGRAMS = [
        'CABEIHM' => ['BS Accountancy', 'BS Hospitality Management', 'BS Business Administration', 'BS Tourism Management'],
        'CICS' => ['BS Information Technology', 'BS Computer Science'],
        'CTE' => ['Bachelor of Secondary Education', 'Bachelor of Elementary Education', 'Bachelor of Physical Education'],
        'CONAHS' => ['BS Nursing', 'BS Nutrition and Dietetics'],
        'CCJE' => ['BS Criminology'],
        'CAS' => ['BS Psychology', 'BA Communication', 'BS Biology', 'BS Mathematics'],
        'LS' => ['Senior High School — STEM', 'Senior High School — ABM', 'Senior High School — HUMSS'],
    ];

    /** Common Filipino given names and surnames. */
    public const MEN = ['Juan', 'Jose', 'Mark', 'John Paul', 'Christian', 'Carlo', 'Paolo', 'Miguel', 'Joshua', 'Kenneth', 'Adrian', 'Nico', 'Rey', 'Luis', 'Enzo', 'Gabriel', 'Rafael', 'Joaquin', 'Andres', 'Mateo', 'Julian', 'Lorenzo', 'Diego', 'Emilio', 'Bryan', 'Jerome', 'Vince', 'Aldrin', 'Jericho', 'Ramil', 'Jomar', 'Kurt', 'Renz', 'Angelo', 'Marvin', 'Jayson', 'Ivan', 'Kyle', 'Francis', 'Elijah'];

    public const WOMEN = ['Maria', 'Angela', 'Bea', 'Camille', 'Denise', 'Erika', 'Faith', 'Gwen', 'Hannah', 'Isabel', 'Jasmine', 'Kyla', 'Leah', 'Mika', 'Nicole', 'Patricia', 'Rica', 'Sofia', 'Trisha', 'Andrea', 'Janine', 'Czarina', 'Ella', 'Kristine', 'Mikaela', 'Bianca', 'Althea', 'Princess', 'Jolina', 'Aubrey', 'Shaira', 'Clarisse', 'Joanna', 'Frances', 'Alyssa', 'Mae', 'Rochelle', 'Danica', 'Lovely', 'Samantha'];

    public const SURNAMES = ['Reyes', 'Santos', 'Cruz', 'Dela Cruz', 'Garcia', 'Aquino', 'Ramos', 'Torres', 'Villanueva', 'Castro', 'Abad', 'Bautista', 'Cabrera', 'Dimaano', 'Escueta', 'Fernandez', 'Gonzales', 'Hernandez', 'Ilagan', 'Javier', 'Katigbak', 'Lopez', 'Manalo', 'Navarro', 'Ocampo', 'Panganiban', 'Quinto', 'Rosales', 'Salazar', 'Tolentino', 'Mendoza', 'Macaraig', 'Marasigan', 'Atienza', 'Magsino', 'Comia', 'Lualhati', 'De Castro', 'Aguilar', 'Perez', 'Dimaculangan', 'Maranan', 'Umali', 'Pasia', 'Buenaventura', 'Mercado', 'Pineda', 'Robles', 'Soriano', 'Evangelista', 'Samonte', 'Delos Santos', 'Rivera', 'Flores', 'Villegas', 'Alcantara', 'Andal', 'Hornilla', 'Landicho', 'Briones'];

    /** Coaches are faculty and alumni: a different set of given names from the students'. */
    public const COACH_MEN = ['Rodel', 'Ferdinand', 'Arnel', 'Dennis', 'Ramon', 'Allan', 'Rolando', 'Edwin', 'Reynaldo', 'Rommel', 'Nestor', 'Jonathan', 'Ronaldo', 'Alvin', 'Efren', 'Danilo', 'Ricardo', 'Wilfredo', 'Manuel', 'Ernesto'];

    public const COACH_WOMEN = ['Marites', 'Liza', 'Teresa', 'Rhea', 'Maribel', 'Josephine', 'Rowena', 'Cecilia', 'Evelyn', 'Marilou', 'Imelda', 'Lorna', 'Susana', 'Rosario', 'Ma. Cristina', 'Jocelyn', 'Divina', 'Leonora', 'Gemma', 'Remedios'];

    public Faker $faker;

    public Carbon $today;

    public string $adminId;

    /** @var array<string, object{id: string, name: string, abbreviation: string}> abbreviation => college */
    public array $colleges = [];

    /** @var array<string, string> category name => id */
    public array $categoryIds = [];

    /** @var array<string, object> "College|Sport" => coach row */
    public array $coaches = [];

    /** @var array<int, object> in judge number order */
    public array $judges = [];

    /** @var array<string, string> venue name => id */
    public array $venues = [];

    /** @var array<string, object> athlete id => row, in athlete-number order */
    public array $athletes = [];

    /** @var array<string, array<int, object>> "coach id|Men" / "coach id|Women" => roster in order (starters first) */
    public array $rosters = [];

    /** Plain-text logins, written to storage/app/demo-credentials.csv. */
    public array $credentials = [];

    /** What the seeders found worth reporting (the medal table, champions…). */
    public array $report = [];

    /** @var array<string, array<int, array{0: int, 1: int}>> judge id => busy [start, end] (unix) */
    private array $judgeBusy = [];

    /** @var array<string, int> judge id => games assigned */
    private array $judgeLoad = [];

    public function __construct()
    {
        $this->faker = FakerFactory::create('en_PH');
        $this->faker->seed(self::SEED);
        $this->today = Carbon::today();
    }

    /** (Re)load the lookups from the database — what earlier seeders wrote. */
    public function load(): self
    {
        $this->adminId = (string) DB::table('users')->where('role', 'admin')->orderBy('created_at')->value('id');

        $this->colleges = [];
        $rows = DB::table('departments')->get(['id', 'name', 'abbreviation'])->keyBy('abbreviation');
        foreach (array_keys(self::COLLEGES) as $abbr) {
            if ($row = $rows[$abbr] ?? null) {
                $this->colleges[$abbr] = $row;
            }
        }

        $this->categoryIds = DB::table('categories')->pluck('id', 'name')->all();
        $this->venues = DB::table('venues')->pluck('id', 'name')->all();

        $this->coaches = [];
        foreach (DB::table('users')->where('role', 'coach')->get() as $coach) {
            $this->coaches[$this->coachKey($coach->department, $coach->sport)] = $coach;
        }

        $this->judges = DB::table('users')->where('role', 'judge')->get()
            ->sortBy(fn ($j) => self::number($j->email))->values()->all();

        $this->athletes = $this->rosters = [];
        $rows = DB::table('athletes')->leftJoin('users', 'users.id', '=', 'athletes.user_id')
            ->get(['athletes.id', 'athletes.coach_id', 'athletes.first_name', 'athletes.last_name', 'athletes.sport', 'athletes.jersey_number',
                'athletes.department', 'athletes.email', 'athletes.status', 'users.gender'])
            ->sortBy(fn ($a) => self::number((string) $a->email));
        foreach ($rows as $a) {
            $this->athletes[$a->id] = $a;
            $this->rosters[$a->coach_id.'|'.($a->gender === 'Female' ? 'Women' : 'Men')][] = $a;
        }

        return $this;
    }

    // ── Teams ───────────────────────────────────────────────────────────

    /**
     * The coaches, coach1–49: [n, sport, college]. Coach n has sport n % 7 at
     * college (n % 7 + ⌊n / 7⌋) % 7 — so coach1–7 each have their own sport
     * at their own college, coach1–14 are two per college, and the 49
     * together cover every college × sport once.
     */
    public static function coachSlots(): array
    {
        $sports = array_keys(self::SPORTS);
        $abbrs = array_keys(self::COLLEGES);
        $slots = [];
        for ($n = 0; $n < count($sports) * count($abbrs); $n++) {
            $s = $n % count($sports);
            $slots[] = ['n' => $n + 1, 'sport' => $sports[$s], 'college' => $abbrs[($s + intdiv($n, count($sports))) % count($abbrs)]];
        }

        return $slots;
    }

    /** Every team, in coach order — each coach's Men's team, then Women's (athlete1 is coach1's first Men's player). */
    public static function teams(): array
    {
        $teams = [];
        foreach (self::coachSlots() as $slot) {
            foreach (['Men', 'Women'] as $division) {
                $teams[] = ['n' => count($teams) + 1, 'coach' => $slot['n'], 'sport' => $slot['sport'], 'division' => $division, 'college' => $slot['college']];
            }
        }

        return $teams;
    }

    public function coachKey(?string $college, ?string $sport): string
    {
        return mb_strtolower("{$college}|{$sport}");
    }

    /** The coach of a college's team in a sport (college by name or abbreviation); they run both divisions. */
    public function coach(string $college, string $sport, ?string $division = null): ?object
    {
        $name = self::COLLEGES[$college] ?? $college;

        return $this->coaches[$this->coachKey($name, $sport)] ?? null;
    }

    /** A coach's players in one division, or in both (Men's first). */
    public function roster(?object $coach, ?string $division = null): array
    {
        if (! $coach) {
            return [];
        }
        if ($division) {
            return $this->rosters["{$coach->id}|{$division}"] ?? [];
        }

        return [...($this->rosters["{$coach->id}|Men"] ?? []), ...($this->rosters["{$coach->id}|Women"] ?? [])];
    }

    /**
     * [sport, division] for a category: "Basketball — Men" → [Basketball, Men],
     * "Badminton — W Doubles" → [Badminton, Women].
     */
    public static function parse(string $category): array
    {
        [$sport, $rest] = array_pad(explode(' — ', $category, 2), 2, '');
        $division = match (true) {
            $rest === 'Women' || str_starts_with($rest, 'W ') => 'Women',
            default => 'Men',
        };

        return [$sport, $division];
    }

    // ── Strength and seeding ────────────────────────────────────────────

    /**
     * Every bracketed category, in the order last year's favourites are
     * handed out: the brackets that finish this run first, so their
     * favourites are spread over all seven colleges and the overall race
     * stays close.
     */
    public const CATEGORY_ORDER = [
        'Basketball — Women', 'Volleyball — Women', 'Beach Volleyball — Men', 'Sepak Takraw — Men', 'Chess — Men',
        'Badminton — M Singles A', 'Badminton — M Singles B', 'Badminton — M Doubles',
        'Table Tennis — M Singles A', 'Table Tennis — M Singles B', 'Table Tennis — M Doubles',
        'Basketball — Men', 'Volleyball — Men', 'Beach Volleyball — Women', 'Sepak Takraw — Women', 'Chess — Women',
        'Badminton — W Singles A', 'Badminton — W Singles B', 'Badminton — W Doubles',
        'Table Tennis — W Singles A', 'Table Tennis — W Singles B', 'Table Tennis — W Doubles',
    ];

    /**
     * Last year's final ranking in a category, best first: the seeding for
     * this year's draw, and roughly how strong each college is. Each
     * category has its own favourite and its own order behind it.
     */
    public static function previousRanking(string $category): array
    {
        $c = array_search($category, self::CATEGORY_ORDER, true);
        $c = $c === false ? crc32($category) % 7 : $c;
        $abbrs = array_keys(self::COLLEGES);
        $step = 1 + $c % 6;   // coprime with 7: a full permutation
        $order = [];
        for ($i = 0; $i < count($abbrs); $i++) {
            $order[] = $abbrs[($c + $i * $step) % count($abbrs)];
        }

        return $order;
    }

    /** @var array<string, array<string, int>> */
    private array $strength = [];

    /** A college's strength in a category: last year's rank, give or take. */
    public function strength(string $category, string $college): int
    {
        $key = $category;
        if (! isset($this->strength[$key])) {
            foreach (self::previousRanking($category) as $rank => $abbr) {
                $this->strength[$key][$abbr] = 92 - $rank * 7 + mt_rand(-6, 6);
            }
        }
        $abbr = $this->abbr($college);

        return $this->strength[$key][$abbr] ?? 60;
    }

    public function abbr(string $college): string
    {
        return array_search($college, self::COLLEGES, true) ?: $college;
    }

    // ── Judges ──────────────────────────────────────────────────────────

    /**
     * A judge for a game: one who works the sport and is free then, the
     * least busy first; failing that anyone free; failing that the least
     * busy.
     */
    public function pickJudge(string $category, Carbon $start, Carbon $end): object
    {
        [$sport] = self::parse($category);
        $window = [$start->timestamp, $end->timestamp];
        $free = fn ($j) => collect($this->judgeBusy[$j->id] ?? [])->every(fn ($b) => $b[1] <= $window[0] || $b[0] >= $window[1]);
        $byLoad = fn ($list) => collect($list)->sortBy(fn ($j) => [$this->judgeLoad[$j->id] ?? 0, self::number($j->email)])->values();

        $specialists = array_filter($this->judges, fn ($j) => in_array($sport, self::JUDGE_SPORTS[self::number($j->email)] ?? [], true));
        $judge = $byLoad($specialists)->first($free) ?? $byLoad($this->judges)->first($free) ?? $byLoad($this->judges)->first();
        $this->judgeBusy[$judge->id][] = $window;
        $this->judgeLoad[$judge->id] = ($this->judgeLoad[$judge->id] ?? 0) + 1;

        return $judge;
    }

    /** Forget a game's judge booking (the game moved). */
    public function releaseJudge(string $judgeId, Carbon $start, Carbon $end): void
    {
        $this->judgeBusy[$judgeId] = array_values(array_filter(
            $this->judgeBusy[$judgeId] ?? [],
            fn ($b) => ! ($b[0] === $start->timestamp && $b[1] === $end->timestamp),
        ));
        $this->judgeLoad[$judgeId] = max(0, ($this->judgeLoad[$judgeId] ?? 1) - 1);
    }

    /** The number in "athlete12@…" → 12. */
    public static function number(string $email): int
    {
        return preg_match('/(\d+)@/', $email, $m) ? (int) $m[1] : PHP_INT_MAX;
    }

    public function email(string $role, int $n): string
    {
        return "{$role}{$n}".self::DOMAIN;
    }
}
