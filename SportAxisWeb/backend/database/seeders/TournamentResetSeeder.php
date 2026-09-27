<?php

namespace Database\Seeders;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * DESTRUCTIVE — step 1 of 2. Wipes the site clean and sets up a fresh
 * intramurals, keeping only the admin accounts (still signed in) and the
 * colleges' records (so their logos survive).
 *
 * Then it sets up:
 *   - the seven colleges (exactly these; any other college is removed)
 *   - the season, eligibility checklist and registration codes
 *   - the sports: Basketball, Volleyball, Beach Volleyball, Sepak Takraw and
 *     Chess, each with a Men's and a Women's division ("Basketball — Men"),
 *     and Badminton and Table Tennis with their Men's / Women's lines
 *   - a venue for each sport
 *   - accounts, all with the password `demo1234`:
 *       coach1–14@g.batstate-u.edu.ph      a Men's and a Women's coach per college,
 *                                          each handling all seven sports
 *       athlete1–980@g.batstate-u.edu.ph   per college, per sport, 10 men + 10 women,
 *                                          jersey numbers, on the campus registry
 *       judge1–10@g.batstate-u.edu.ph      committee members
 *
 * Step 2, TournamentActivitySeeder, then fills the competition and the
 * day-to-day records. Two steps so neither runs past a shared host's
 * request time limit.
 *
 *   /artisan-migrate?token=<TOKEN>&seed=1&class=TournamentResetSeeder
 *   /artisan-migrate?token=<TOKEN>&seed=1&class=TournamentActivitySeeder
 */
class TournamentResetSeeder extends Seeder
{
    public const PASSWORD = 'demo1234';

    public const DOMAIN = '@g.batstate-u.edu.ph';

    private const PRIVACY_NOTICE_VERSION = '2026-09-21';

    private const JUDGE_COUNT = 10;

    /** Athletes per college, per sport, per gender. */
    public const PER_TEAM = 10;

    /** Tables left alone (users, tokens and colleges are pruned, not wiped). */
    private const KEEP = ['migrations', 'users', 'personal_access_tokens', 'departments'];

    /** name => description. All head-to-head. */
    public const SPORTS = [
        'Basketball' => 'Five-a-side basketball.',
        'Volleyball' => 'Indoor volleyball, best of three sets.',
        'Beach Volleyball' => 'Beach volleyball pairs.',
        'Sepak Takraw' => 'Regu competition, best of three sets.',
        'Badminton' => 'Singles and doubles lines.',
        'Table Tennis' => 'Singles and doubles lines.',
        'Chess' => 'Four-board team chess.',
    ];

    /** Sports played in Men's and Women's divisions (the racquet sports use lines). */
    public const DIVISION_SPORTS = ['Basketball', 'Volleyball', 'Beach Volleyball', 'Sepak Takraw', 'Chess'];

    /** The colleges, in this order: abbreviation => name. */
    public const COLLEGES = [
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

    /** name => [type, capacity, sports, location, facilities]. */
    public const VENUES = [
        'Joson Gymnasium' => ['Gymnasium', 1200, ['Basketball', 'Volleyball'], 'Main Campus', 'Two full courts, bleachers, scoreboard, sound system'],
        'ARASOF Covered Court' => ['Covered Court', 800, ['Volleyball', 'Basketball', 'Sepak Takraw'], 'Main Campus', 'Covered court, bleachers, net posts'],
        'Nasugbu Sand Court' => ['Outdoor Court', 300, ['Beach Volleyball'], 'Beachfront Annex', 'Two sand courts, shaded seating'],
        'Red Floor Court' => ['Indoor Court', 250, ['Sepak Takraw'], 'Sports Complex', 'Regulation takraw court, net, scoreboard'],
        'Badminton Hall' => ['Indoor Hall', 200, ['Badminton'], 'Sports Complex', 'Four synthetic courts'],
        'Table Tennis Center' => ['Indoor Hall', 120, ['Table Tennis'], 'Sports Complex', 'Six ITTF tables, barriers, umpire chairs'],
        'Student Center Hall' => ['Function Hall', 150, ['Chess'], 'Student Center', 'Tournament tables, clocks, demo board'],
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

    /** 25 × 30 = 750 unique names per gender — enough for 490 each. */
    private const MEN = ['Paolo', 'Miguel', 'Josh', 'Kenneth', 'Adrian', 'Nico', 'Rey', 'Carlo', 'Luis', 'Enzo', 'Gabriel', 'Rafael', 'Joaquin', 'Andres', 'Mateo', 'Julian', 'Lorenzo', 'Diego', 'Emilio', 'Santi', 'Bryan', 'Jerome', 'Mark', 'Vince', 'Aldrin'];

    private const WOMEN = ['Angela', 'Bea', 'Camille', 'Denise', 'Erika', 'Faith', 'Gwen', 'Hannah', 'Isabel', 'Jasmine', 'Kyla', 'Leah', 'Mika', 'Nicole', 'Patricia', 'Rica', 'Sofia', 'Trisha', 'Andrea', 'Janine', 'Czarina', 'Ella', 'Kristine', 'Mikaela', 'Bianca'];

    private const SURNAMES = ['Reyes', 'Santos', 'Cruz', 'Dela Paz', 'Garcia', 'Aquino', 'Ramos', 'Torres', 'Villa', 'Castro', 'Abad', 'Bautista', 'Cabrera', 'Dimaano', 'Escueta', 'Fernandez', 'Gonzales', 'Hernandez', 'Ilagan', 'Javier', 'Katigbak', 'Lopez', 'Manalo', 'Navarro', 'Ocampo', 'Panganiban', 'Quinto', 'Rosales', 'Salazar', 'Tolentino'];

    private const PROGRAMS = [
        'CABEIHM' => ['BS Accountancy', 'BS Hospitality Management', 'BS Business Administration'],
        'CICS' => ['BS Information Technology', 'BS Computer Science'],
        'CTE' => ['Bachelor of Secondary Education', 'Bachelor of Physical Education'],
        'CONAHS' => ['BS Nursing', 'BS Nutrition and Dietetics'],
        'CCJE' => ['BS Criminology'],
        'CAS' => ['BS Psychology', 'BA Communication', 'BS Biology'],
        'LS' => ['Senior High School — STEM', 'Senior High School — ABM'],
    ];

    private string $password;

    /** @var array<string, string> sport name => category id */
    private array $sportIds = [];

    public function run(): void
    {
        $admins = DB::table('users')->where('role', 'admin')->pluck('id');
        if ($admins->isEmpty()) {
            throw new \RuntimeException('No admin account found — refusing to reset, it would lock everyone out.');
        }
        @set_time_limit(300);

        $this->password = Hash::make(self::PASSWORD);

        AuditLog::withoutRecording(function () use ($admins) {
            $this->wipe($admins->all());
            $this->seedReference($admins->first());
            $this->seedSports();
            $this->seedVenues($admins->first());
            $colleges = $this->colleges();
            $coaches = $this->seedCoaches($colleges);
            $this->seedJudges();
            $this->seedAthletes($coaches);
        });

        Cache::flush();

        $this->command?->info(sprintf(
            'Reset done — %d colleges, coach1–%d, athlete1–%d, judge1–%d %s, password %s. Next: TournamentActivitySeeder.',
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
        } finally {
            Schema::enableForeignKeyConstraints();
        }

        // Files the wiped rows pointed at (requirement uploads, slides).
        foreach (['requirements', 'site-slides', 'demo-reset'] as $dir) {
            Storage::disk('public')->deleteDirectory($dir);
        }
    }

    // ── Reference data ──────────────────────────────────────────────────

    private function seedReference(string $adminId): void
    {
        $reference = new ReferenceDataSeeder;
        $reference->seedDefaultSeason();
        $reference->seedDefaultRequirementTypes();
        DB::table('seasons')->update(['starts_on' => now()->subMonth()->toDateString(), 'ends_on' => now()->addMonths(2)->toDateString()]);

        foreach ([
            ['ADMIN-2627', 'admin', 'Sports Office staff'],
            ['COACH-2627', 'coach', 'Coaches, 2025–2026 Intramurals'],
            ['JUDGE-2627', 'judge', 'Committee members, 2025–2026 Intramurals'],
            ['ATHLETE-2627', 'athlete', 'Athletes, 2025–2026 Intramurals'],
        ] as [$code, $role, $label]) {
            DB::table('registration_codes')->insert([
                'code' => $code, 'role' => $role, 'label' => $label, 'used' => false,
                'created_by' => $adminId, 'expires_at' => now()->addMonths(3),
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
    }

    private function seedSports(): void
    {
        foreach (self::SPORTS as $name => $description) {
            DB::table('categories')->insert([
                'id' => (string) Str::uuid(), 'name' => $name, 'description' => $description,
                'format' => 'versus', 'created_at' => now(), 'updated_at' => now(),
            ]);
        }
        $parents = DB::table('categories')->pluck('id', 'name');

        // Men's and Women's divisions, each its own sport for standings and medals.
        foreach (self::DIVISION_SPORTS as $sport) {
            foreach (['Men', 'Women'] as $division) {
                DB::table('categories')->insert([
                    'id' => (string) Str::uuid(), 'name' => "{$sport} — {$division}",
                    'description' => "{$division}'s {$sport}.", 'format' => 'versus',
                    'parent_sport' => $sport, 'division' => $division, 'parent_id' => $parents[$sport],
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            }
        }

        // Badminton and Table Tennis: Singles A/B and Doubles, Men's and Women's.
        (new ReferenceDataSeeder)->seedRacquetDisciplines();
        foreach (['Badminton', 'Table Tennis'] as $sport) {
            DB::table('categories')->where('parent_sport', $sport)->update(['parent_id' => $parents[$sport]]);
        }

        $this->sportIds = $parents->all();
    }

    private function seedVenues(string $adminId): void
    {
        foreach (self::VENUES as $name => [$type, $capacity, $sports, $location, $facilities]) {
            DB::table('venues')->insert([
                'id' => (string) Str::uuid(), 'name' => $name, 'type' => $type, 'capacity' => $capacity,
                'sports' => json_encode($sports), 'location' => $location, 'facilities' => $facilities,
                'status' => 'available', 'created_by' => $adminId, 'created_at' => now(), 'updated_at' => now(),
            ]);
        }
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
                    'phone' => sprintf('+63917%07d', 1000000 + $n * 7919),
                    'enrollment_code' => "{$college->abbreviation}-".($division === 'Men' ? 'M' : 'W').'-2627',
                    'privacy_notice_accepted_at' => now()->subMonth(),
                    'privacy_notice_version' => self::PRIVACY_NOTICE_VERSION,
                    'created_at' => now()->subMonth(),
                ])->save();
                $coaches[$i][$division] = $coach;
            }
        }

        return $coaches;
    }

    private function seedJudges(): void
    {
        for ($n = 1; $n <= self::JUDGE_COUNT; $n++) {
            (new User)->forceFill([
                'id' => (string) Str::uuid(),
                'email' => "judge{$n}".self::DOMAIN,
                'password' => $this->password,
                'name' => self::JUDGE_NAMES[$n - 1],
                'role' => 'judge',
                'active' => true,
                'phone' => sprintf('+63918%07d', 2000000 + $n * 6007),
                'privacy_notice_accepted_at' => now()->subMonth(),
                'privacy_notice_version' => self::PRIVACY_NOTICE_VERSION,
                'created_at' => now()->subMonth(),
            ])->save();
        }
    }

    /**
     * athlete1… in order college → sport → Men, Women: 10 men on the Men's
     * coach's team (jerseys 1–10), 10 women on the Women's (11–20). Written
     * in batches: a web request on shared hosting has a time limit.
     */
    private function seedAthletes(array $coaches): void
    {
        $users = $athletes = $registry = [];
        $n = 0;
        $counter = ['Male' => 0, 'Female' => 0];
        $abbrs = array_keys(self::COLLEGES);

        foreach ($coaches as $i => $pair) {
            $programs = self::PROGRAMS[$abbrs[$i]];
            foreach (array_keys(self::SPORTS) as $sport) {
                foreach (['Male' => 0, 'Female' => self::PER_TEAM] as $gender => $jerseyOffset) {
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
                        $year = $abbrs[$i] === 'LS' ? 'Grade '.(11 + $n % 2) : (1 + $n % 4).['st', 'nd', 'rd', 'th'][$n % 4].' Year';
                        $course = $programs[$n % count($programs)];
                        $joined = now()->subDays(25 + $n % 10);
                        $contact = json_encode(['name' => ($n % 2 ? 'Rosario ' : 'Ernesto ').$last, 'relationship' => 'Parent', 'phone' => sprintf('+63919%07d', 3000000 + $n)]);

                        $users[] = [
                            'id' => $id, 'email' => $email, 'password' => $this->password, 'name' => "{$first} {$last}",
                            'role' => 'athlete', 'active' => true, 'sr_code' => $sr, 'gender' => $gender,
                            'student_verified_at' => $joined, 'department' => $coach->department, 'department_id' => $coach->department_id,
                            'year_level' => $year, 'course' => $course, 'phone' => sprintf('+63920%07d', 4000000 + $n),
                            'emergency_contact' => $contact, 'sport' => $sport, 'sports' => json_encode([$sport]),
                            'coach_id' => $coach->id, 'coach_name' => $coach->name, 'enrolled_at' => $joined,
                            'privacy_notice_accepted_at' => $joined, 'privacy_notice_version' => self::PRIVACY_NOTICE_VERSION,
                            'created_at' => $joined, 'updated_at' => $joined,
                        ];
                        $athletes[] = [
                            'id' => $id, 'user_id' => $id, 'student_id' => $sr, 'first_name' => $first, 'last_name' => $last,
                            'email' => $email, 'department' => $coach->department, 'year_level' => $year, 'course' => $course,
                            'coach_id' => $coach->id, 'sport' => $sport, 'category_id' => $this->sportIds[$sport] ?? null,
                            'status' => $n % 37 === 0 ? 'injured' : 'active', 'jersey_number' => (string) ($j + $jerseyOffset),
                            'emergency_contact' => $contact, 'enrolled_via_code' => true, 'enrolled_at' => $joined,
                            'created_at' => $joined, 'updated_at' => $joined,
                        ];
                        $registry[] = [
                            'sr_code' => $sr, 'first_name' => $first, 'last_name' => $last, 'gender' => $gender,
                            'college' => $coach->department, 'program' => $course, 'year_level' => $year,
                            'email' => $email, 'created_at' => now(), 'updated_at' => now(),
                        ];
                    }
                }
            }
        }

        foreach (['users' => $users, 'athletes' => $athletes, 'campus_students' => $registry] as $table => $rows) {
            foreach (array_chunk($rows, 200) as $chunk) {
                DB::table($table)->insert($chunk);
            }
        }
    }
}
