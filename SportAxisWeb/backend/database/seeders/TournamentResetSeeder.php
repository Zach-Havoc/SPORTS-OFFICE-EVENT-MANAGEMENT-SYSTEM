<?php

namespace Database\Seeders;

use App\Models\AuditLog;
use App\Models\Event;
use App\Models\User;
use App\Services\BracketService;
use App\Services\LineupRules;
use App\Services\PlayByPlay;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * DESTRUCTIVE. Resets the site to a fresh intramurals with a full set of test
 * accounts, keeping the admin.
 *
 * Kept as they are: every admin account (and its sign-in), venues, seasons,
 * the eligibility checklist, registration codes, the home-page slideshow and
 * the campus student registry. Everything else is wiped — every other
 * account, events, scores, brackets, lineups, announcements, attendance,
 * requirements, notifications, logs.
 *
 * The colleges become exactly the seven in COLLEGES: an existing college
 * with the same name or abbreviation is kept (logo and all) under the
 * canonical name; any other college is removed.
 *
 * Then it creates, all with the password `demo1234`:
 *   coach1–14@g.batstate-u.edu.ph    two per college — a Men's and a Women's
 *                                    coach — each handling all seven sports
 *   athlete1–980@g.batstate-u.edu.ph   per college, per sport: 10 men (on the
 *                                    Men's coach's team) and 10 women (on the
 *                                    Women's), each with a jersey number, on the
 *                                    campus registry, privacy notice accepted
 *   judge1–10@g.batstate-u.edu.ph    committee members
 * the sports Basketball, Volleyball, Beach Volleyball, Sepak Takraw,
 * Badminton, Table Tennis and Chess (with the racquet sports' Men's and
 * Women's lines), and a published single-elimination bracket for every
 * sport and division — Men's and Women's for the team sports and chess,
 * every racquet line — with a judge on each game, every known matchup's
 * lineups filled in, and every coach's racquet lines entered.
 *
 * On the deployed site (no shell there):
 *   /artisan-migrate?token=<TOKEN>&seed=1&class=TournamentResetSeeder
 * Locally:
 *   php artisan db:seed --class=TournamentResetSeeder
 */
class TournamentResetSeeder extends Seeder
{
    private const PASSWORD = 'demo1234';

    private const DOMAIN = '@g.batstate-u.edu.ph';

    private const PRIVACY_NOTICE_VERSION = '2026-09-21';

    private const JUDGE_COUNT = 10;

    /** Athletes per coach, per sport, per gender. */
    private const PER_TEAM = 10;

    /** Tables left untouched (users and tokens are pruned, not wiped). */
    private const KEEP = [
        'migrations', 'users', 'personal_access_tokens', 'departments', 'venues', 'seasons',
        'requirement_types', 'categories', 'registration_codes', 'site_slides', 'campus_students',
    ];

    /** name => description. All head-to-head. */
    private const SPORTS = [
        'Basketball' => 'Five-a-side basketball, Men\'s and Women\'s.',
        'Volleyball' => 'Indoor volleyball, Men\'s and Women\'s.',
        'Beach Volleyball' => 'Beach volleyball pairs, Men\'s and Women\'s.',
        'Sepak Takraw' => 'Regu competition, Men\'s and Women\'s.',
        'Badminton' => 'Singles and doubles lines, Men\'s and Women\'s.',
        'Table Tennis' => 'Singles and doubles lines, Men\'s and Women\'s.',
        'Chess' => 'Standard chess, Men\'s and Women\'s.',
    ];

    /** The colleges, in this order: abbreviation => name. */
    private const COLLEGES = [
        'CABEIHM' => 'College of Accountancy, Business, Economics, and International Hospitality Management',
        'CICS' => 'College of Informatics and Computing Sciences',
        'CTE' => 'College of Teacher Education',
        'CONAHS' => 'College of Nursing and Allied Health Sciences',
        'CCJE' => 'College of Criminal Justice Education',
        'CAS' => 'College of Arts and Sciences',
        'LS' => 'Laboratory School',
    ];

    /** Other spellings an existing college might be stored under. */
    private const ALIASES = [
        'CONAHS' => ['CONHAS'],
        'LS' => ['LAB', 'LABSCHOOL'],
    ];

    /** [Men's coach, Women's coach] per college, in COLLEGES order. */
    private const COACH_NAMES = [
        ['Marco Villanueva', 'Joanna Castillo'],
        ['Rafael Dimaculangan', 'Carla Macaraig'],
        ['Dennis Ramirez', 'Liza Marasigan'],
        ['Arnel Bautista', 'Kristine Ilagan'],
        ['Ramon Atienza', 'Teresa Magsino'],
        ['Jerome Salazar', 'Rhea Tolentino'],
        ['Allan Quinto', 'Maribel Ocampo'],
    ];

    private const JUDGE_NAMES = [
        'Liza Mendoza', 'Arnold Panganiban', 'Grace Umali', 'Ronald Magpantay', 'Sheila Katigbak',
        'Victor Comia', 'Rowena Lualhati', 'Edgar De Castro', 'Maricel Aguilar', 'Noel Perez',
    ];

    /** 25 × 30 = 750 unique names per gender — enough for 700 each. */
    private const MEN = ['Paolo', 'Miguel', 'Josh', 'Kenneth', 'Adrian', 'Nico', 'Rey', 'Carlo', 'Luis', 'Enzo', 'Gabriel', 'Rafael', 'Joaquin', 'Andres', 'Mateo', 'Julian', 'Lorenzo', 'Diego', 'Emilio', 'Santi', 'Bryan', 'Jerome', 'Mark', 'Vince', 'Aldrin'];

    private const WOMEN = ['Angela', 'Bea', 'Camille', 'Denise', 'Erika', 'Faith', 'Gwen', 'Hannah', 'Isabel', 'Jasmine', 'Kyla', 'Leah', 'Mika', 'Nicole', 'Patricia', 'Rica', 'Sofia', 'Trisha', 'Andrea', 'Janine', 'Czarina', 'Ella', 'Kristine', 'Mikaela', 'Bianca'];

    private const SURNAMES = ['Reyes', 'Santos', 'Cruz', 'Dela Paz', 'Garcia', 'Aquino', 'Ramos', 'Torres', 'Villa', 'Castro', 'Abad', 'Bautista', 'Cabrera', 'Dimaano', 'Escueta', 'Fernandez', 'Gonzales', 'Hernandez', 'Ilagan', 'Javier', 'Katigbak', 'Lopez', 'Manalo', 'Navarro', 'Ocampo', 'Panganiban', 'Quinto', 'Rosales', 'Salazar', 'Tolentino'];

    private string $password;

    /** @var array<string, string> sport name => category id */
    private array $sportIds = [];

    public function run(): void
    {
        $admins = DB::table('users')->where('role', 'admin')->pluck('id');
        if ($admins->isEmpty()) {
            throw new \RuntimeException('No admin account found — refusing to reset, it would lock everyone out.');
        }

        $this->password = Hash::make(self::PASSWORD);

        AuditLog::withoutRecording(function () use ($admins) {
            $this->wipe($admins->all());
            $this->seedSports();
            $colleges = $this->colleges();
            $coaches = $this->seedCoaches($colleges);
            $judges = $this->seedJudges();
            $this->seedAthletes($coaches);
            $events = $this->seedBrackets($coaches, $judges);
            $this->seedLineups($events, $coaches);
            $this->seedRacquetLines($coaches);
        });

        Cache::flush();

        $this->command?->info(sprintf(
            'Reset done — %d colleges, coach1–%d, athlete1–%d, judge1–%d %s, password %s',
            count(self::COLLEGES), count(self::COLLEGES) * 2, count(self::COLLEGES) * count(self::SPORTS) * 2 * self::PER_TEAM,
            self::JUDGE_COUNT, self::DOMAIN, self::PASSWORD,
        ));
    }

    // ── Wipe ────────────────────────────────────────────────────────────

    private function wipe(array $adminIds): void
    {
        $tables = array_map(fn ($row) => array_values((array) $row)[0], DB::select('SHOW TABLES'));

        Schema::disableForeignKeyConstraints();
        try {
            foreach ($tables as $table) {
                if (! in_array($table, self::KEEP, true)) {
                    DB::table($table)->truncate();
                }
            }

            DB::table('users')->whereNotIn('id', $adminIds)->delete();
            DB::table('users')->whereIn('id', $adminIds)->update(['coach_id' => null, 'coach_name' => null]);
            DB::table('personal_access_tokens')->where(fn ($q) => $q
                ->where('tokenable_type', '!=', User::class)
                ->orWhereNotIn('tokenable_id', $adminIds))->delete();

            // Kept rows may point at accounts that are gone.
            foreach ([
                ['registration_codes', 'created_by'], ['registration_codes', 'used_by'],
                ['requirement_types', 'created_by'], ['site_slides', 'created_by'], ['venues', 'created_by'],
            ] as [$table, $column]) {
                if (Schema::hasColumn($table, $column)) {
                    DB::table($table)->whereNotNull($column)->whereNotIn($column, $adminIds)->update([$column => null]);
                }
            }
        } finally {
            Schema::enableForeignKeyConstraints();
        }
    }

    // ── Sports and colleges ─────────────────────────────────────────────

    private function seedSports(): void
    {
        foreach (self::SPORTS as $name => $description) {
            $id = DB::table('categories')->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->value('id');
            if ($id) {
                DB::table('categories')->where('id', $id)->update(['format' => 'versus', 'updated_at' => now()]);
            } else {
                DB::table('categories')->insert([
                    'id' => (string) Str::uuid(), 'name' => $name, 'description' => $description,
                    'format' => 'versus', 'created_at' => now(), 'updated_at' => now(),
                ]);
            }
        }

        // Badminton and Table Tennis are played in Men's and Women's lines.
        $reference = new ReferenceDataSeeder;
        $reference->seedRacquetDisciplines();
        $reference->seedDefaultRequirementTypes();
        $reference->seedDefaultSeason();
        foreach (['Badminton', 'Table Tennis'] as $sport) {
            DB::table('categories')->where('parent_sport', $sport)
                ->update(['parent_id' => DB::table('categories')->where('name', $sport)->value('id')]);
        }

        $this->sportIds = DB::table('categories')->whereIn('name', array_keys(self::SPORTS))->pluck('id', 'name')->all();
    }

    /**
     * Exactly the seven colleges. One already on the site under the same name
     * or abbreviation keeps its row (and logo) and takes the canonical name;
     * missing ones are created; any other college is removed.
     *
     * @return array<int, object> in COLLEGES order
     */
    private function colleges(): array
    {
        $key = fn (?string $v) => mb_strtolower(trim((string) $v));
        $existing = DB::table('departments')->get(['id', 'name', 'abbreviation']);
        $colleges = [];

        foreach (self::COLLEGES as $abbr => $name) {
            $spellings = array_map($key, [$name, $abbr, ...(self::ALIASES[$abbr] ?? [])]);
            $row = $existing->first(fn ($d) => in_array($key($d->name), $spellings, true) || in_array($key($d->abbreviation), $spellings, true));

            if ($row) {
                DB::table('departments')->where('id', $row->id)->update(['name' => $name, 'abbreviation' => $abbr, 'updated_at' => now()]);
                $id = $row->id;
            } else {
                $id = (string) Str::uuid();
                DB::table('departments')->insert(['id' => $id, 'name' => $name, 'abbreviation' => $abbr, 'created_at' => now(), 'updated_at' => now()]);
            }
            $colleges[] = (object) ['id' => $id, 'name' => $name, 'abbreviation' => $abbr];
        }

        // Anything left over goes; an admin's college link clears itself (FK set null).
        DB::table('departments')->whereNotIn('id', array_column($colleges, 'id'))->delete();

        return $colleges;
    }

    // ── People ──────────────────────────────────────────────────────────

    /**
     * Two coaches per college: coach1 is the first college's Men's coach,
     * coach2 its Women's, and so on.
     *
     * @return array<int, array{Men: User, Women: User}> in college order
     */
    private function seedCoaches(array $colleges): array
    {
        $coaches = [];
        $n = 0;
        foreach ($colleges as $i => $college) {
            foreach (['Men', 'Women'] as $g => $division) {
                $n++;
                $coach = new User;
                $coach->forceFill([
                    'id' => (string) Str::uuid(),
                    'email' => "coach{$n}".self::DOMAIN,
                    'password' => $this->password,
                    'name' => self::COACH_NAMES[$i][$g],
                    'role' => 'coach',
                    'active' => true,
                    'department' => $college->name,
                    'department_id' => $college->id,
                    'sport' => array_key_first(self::SPORTS),
                    'sports' => array_keys(self::SPORTS),    // coach_category follows (User::syncSportKeys)
                    'gender_category' => $division,
                    'enrollment_code' => "{$college->abbreviation}-".($division === 'Men' ? 'M' : 'W').'-2627',
                    'privacy_notice_accepted_at' => now(),
                    'privacy_notice_version' => self::PRIVACY_NOTICE_VERSION,
                ])->save();
                $coaches[$i][$division] = $coach;
            }
        }

        return $coaches;
    }

    /** @return array<int, User> */
    private function seedJudges(): array
    {
        $judges = [];
        for ($n = 1; $n <= self::JUDGE_COUNT; $n++) {
            $judge = new User;
            $judge->forceFill([
                'id' => (string) Str::uuid(),
                'email' => "judge{$n}".self::DOMAIN,
                'password' => $this->password,
                'name' => self::JUDGE_NAMES[$n - 1],
                'role' => 'judge',
                'active' => true,
                'privacy_notice_accepted_at' => now(),
                'privacy_notice_version' => self::PRIVACY_NOTICE_VERSION,
            ])->save();
            $judges[] = $judge;
        }

        return $judges;
    }

    /**
     * athlete1… in order college → sport → Men, Women: 10 men on the Men's
     * coach's team, 10 women on the Women's. Written in batches: a web request
     * on shared hosting has a time limit, and ~1,000 one-by-one saves would
     * run past it.
     */
    private function seedAthletes(array $coaches): void
    {
        $users = $athletes = $registry = [];
        $n = 0;
        $counter = ['Male' => 0, 'Female' => 0];
        $now = now();

        foreach ($coaches as $pair) {
            foreach (array_keys(self::SPORTS) as $sport) {
                foreach (['Male' => 0, 'Female' => self::PER_TEAM] as $gender => $jerseyOffset) {
                    // Women wear 11–20, so a game neither division owns never has two #4s.
                    $coach = $pair[$gender === 'Male' ? 'Men' : 'Women'];
                    for ($j = 1; $j <= self::PER_TEAM; $j++) {
                        $n++;
                        $idx = $counter[$gender]++;
                        $firsts = $gender === 'Male' ? self::MEN : self::WOMEN;
                        $first = $firsts[$idx % count($firsts)];
                        $last = self::SURNAMES[intdiv($idx, count($firsts)) % count(self::SURNAMES)];
                        $id = (string) Str::uuid();
                        $sr = sprintf('26-%05d', 90000 + $n);
                        $email = "athlete{$n}".self::DOMAIN;
                        $year = (1 + $n % 4).['st', 'nd', 'rd', 'th'][$n % 4].' Year';

                        $users[] = [
                            'id' => $id, 'email' => $email, 'password' => $this->password, 'name' => "{$first} {$last}",
                            'role' => 'athlete', 'active' => true, 'sr_code' => $sr, 'gender' => $gender,
                            'student_verified_at' => $now, 'department' => $coach->department, 'department_id' => $coach->department_id,
                            'year_level' => $year, 'course' => 'BS Test Program', 'sport' => $sport, 'sports' => json_encode([$sport]),
                            'coach_id' => $coach->id, 'coach_name' => $coach->name, 'enrolled_at' => $now,
                            'privacy_notice_accepted_at' => $now, 'privacy_notice_version' => self::PRIVACY_NOTICE_VERSION,
                            'created_at' => $now, 'updated_at' => $now,
                        ];
                        $athletes[] = [
                            'id' => $id, 'user_id' => $id, 'student_id' => $sr, 'first_name' => $first, 'last_name' => $last,
                            'email' => $email, 'department' => $coach->department, 'year_level' => $year, 'course' => 'BS Test Program',
                            'coach_id' => $coach->id, 'sport' => $sport, 'category_id' => $this->sportIds[$sport] ?? null,
                            'status' => 'active', 'jersey_number' => (string) ($j + $jerseyOffset),
                            'enrolled_via_code' => true, 'enrolled_at' => $now, 'created_at' => $now, 'updated_at' => $now,
                        ];
                        $registry[] = [
                            'sr_code' => $sr, 'first_name' => $first, 'last_name' => $last, 'gender' => $gender,
                            'college' => $coach->department, 'program' => 'BS Test Program', 'year_level' => $year,
                            'email' => $email, 'created_at' => $now, 'updated_at' => $now,
                        ];
                    }
                }
            }
        }

        foreach (array_chunk($users, 200) as $chunk) {
            DB::table('users')->insert($chunk);
        }
        foreach (array_chunk($athletes, 200) as $chunk) {
            DB::table('athletes')->insert($chunk);
        }
        foreach (array_chunk($registry, 200) as $chunk) {
            DB::table('campus_students')->upsert($chunk, ['sr_code'], ['first_name', 'last_name', 'gender', 'college', 'program', 'year_level', 'email', 'updated_at']);
        }
    }

    // ── Brackets ────────────────────────────────────────────────────────

    /**
     * A published single-elimination bracket for every sport and division
     * among the colleges: Men's and Women's for each team sport and chess
     * (the division names the bracket and its games), and one per racquet
     * line ("Badminton — W Singles A"). Each bracket gets its own day and
     * venue so no two share a court at once, and every game a judge.
     *
     * @return Collection<int, Event> every game the brackets created
     */
    private function seedBrackets(array $coaches, array $judges): Collection
    {
        $service = app(BracketService::class);
        $colleges = array_values(array_map(fn (array $pair) => $pair['Men']->department, $coaches));
        $venues = DB::table('venues')->pluck('id')->all();

        $plans = [];
        foreach (array_keys(self::SPORTS) as $sport) {
            if (in_array($sport, ['Badminton', 'Table Tennis'], true)) {
                foreach (['M', 'W'] as $g) {
                    foreach (['Singles A', 'Singles B', 'Doubles'] as $line) {
                        $plans[] = ['sport' => "{$sport} — {$g} {$line}", 'division' => null];
                    }
                }
            } else {
                foreach (['Men', 'Women'] as $division) {
                    $plans[] = ['sport' => $sport, 'division' => $division];
                }
            }
        }

        $events = collect();
        $judge = 0;
        foreach ($plans as $i => $plan) {
            // A different draw each time: rotate who meets whom.
            $order = [...array_slice($colleges, $i % count($colleges)), ...array_slice($colleges, 0, $i % count($colleges))];

            $bracket = $service->generate([
                'sport' => $plan['sport'],
                'division' => $plan['division'],
                'format' => 'single_elimination',
                'drawMethod' => 'manual',
                'participants' => $order,
                'startDate' => now()->addDays(1 + ($venues ? intdiv($i, count($venues)) : $i))->toDateString(),
                'startTime' => '08:00',
                'matchDuration' => 60,
                'breakDuration' => 15,
                'venueId' => $venues ? $venues[$i % count($venues)] : null,
            ]);
            $result = $service->publish($bracket);
            if (! empty($result['conflicts'])) {
                throw new \RuntimeException("Couldn't schedule the {$bracket->name} bracket: a venue is already booked.");
            }

            foreach (Event::whereIn('id', $bracket->fresh('matches')->matches->pluck('event_id')->filter())->get() as $event) {
                $j = $judges[$judge++ % count($judges)];
                $event->update(['judges' => [['id' => $j->id, 'name' => $j->name, 'email' => $j->email]]]);
                $events->push($event);
            }
        }

        return $events;
    }

    /**
     * Lineups for every game whose two colleges are known (round one), from
     * each college's coach for that division: basketball and volleyball send
     * all ten (the first six in the volleyball rotation), a sepak takraw regu
     * of five (Tekong, Feeder, Striker, two subs), beach volleyball a pair and
     * a reserve, chess six (boards 1–4, two reserves). Later rounds fill in
     * as teams advance — a team carries its lineup forward.
     */
    private function seedLineups(Collection $events, array $coaches): void
    {
        $byCollege = collect($coaches)->keyBy(fn (array $pair) => $pair['Men']->department_id);
        $rows = [];

        foreach ($events as $event) {
            $sport = LineupRules::sportOf($event);
            $teams = $sport ? PlayByPlay::teams($event) : null;
            if (! $teams) {
                continue;
            }
            $rules = LineupRules::for($sport);
            $division = PlayByPlay::divisionOf($event) ?? 'Men';

            foreach ($teams as $team) {
                $coach = $byCollege[$team->id][$division] ?? null;
                if (! $coach) {
                    continue;
                }
                $players = DB::table('athletes')->where('coach_id', $coach->id)
                    ->whereRaw('LOWER(sport) = ?', [$sport])
                    ->orderByRaw('CAST(jersey_number AS UNSIGNED)')
                    ->limit(min($rules['max'], self::PER_TEAM))
                    ->get(['id', 'jersey_number']);

                foreach ($players as $k => $player) {
                    $rows[] = [
                        'game_id' => $event->id,
                        'team_id' => $team->id,
                        'player_id' => $player->id,
                        'jersey_number' => $player->jersey_number,
                        'rotation_position' => $k < count($rules['positions']) ? $k + 1 : null,
                        'is_starter' => $k < (['basketball' => 5, 'beach volleyball' => 2][$sport] ?? count($rules['positions'])),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                }
            }
        }

        foreach (array_chunk($rows, 300) as $chunk) {
            DB::table('game_players')->insert($chunk);
        }
    }

    /**
     * Every coach's racquet lines, from their own badminton / table tennis
     * players: Singles A, Singles B, and a Doubles pair (C and D) — the Men's
     * coach on the M lines, the Women's on the W lines.
     */
    private function seedRacquetLines(array $coaches): void
    {
        $rows = [];
        foreach ($coaches as $pair) {
            foreach (['Men' => 'M', 'Women' => 'W'] as $division => $g) {
                $coach = $pair[$division];
                foreach (['Badminton', 'Table Tennis'] as $sport) {
                    $players = DB::table('athletes')->where('coach_id', $coach->id)->where('sport', $sport)
                        ->orderByRaw('CAST(jersey_number AS UNSIGNED)')->limit(4)
                        ->get(['id', 'first_name', 'last_name'])->values();
                    $lines = [
                        ["{$sport} — {$g} Singles A", null, $players[0] ?? null],
                        ["{$sport} — {$g} Singles B", null, $players[1] ?? null],
                        ["{$sport} — {$g} Doubles", 'C', $players[2] ?? null],
                        ["{$sport} — {$g} Doubles", 'D', $players[3] ?? null],
                    ];
                    foreach ($lines as [$category, $slot, $athlete]) {
                        if (! $athlete) {
                            continue;
                        }
                        $rows[] = [
                            'id' => (string) Str::uuid(),
                            'category' => $category,
                            'department' => $coach->department,
                            'athlete_id' => $athlete->id,
                            'athlete_name' => "{$athlete->first_name} {$athlete->last_name}",
                            'coach_id' => $coach->id,
                            'pair_slot' => $slot,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                    }
                }
            }
        }

        DB::table('discipline_entries')->insert($rows);
    }
}
