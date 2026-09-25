<?php

namespace Database\Seeders;

use App\Http\Controllers\Api\ScoreController;
use App\Models\AuditLog;
use App\Models\BracketMatch;
use App\Models\Event;
use App\Models\LiveScore;
use App\Models\Score;
use App\Models\TeamMatch;
use App\Services\BracketService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * DESTRUCTIVE. Wipes every application table and reseeds a realistic demo
 * dataset (colleges, coaches, athletes, brackets with results, live game,
 * attendance, requirements, announcements…), keeping ONLY the four test
 * accounts — their ids, names and password hashes are preserved exactly.
 *
 * Unlike `?fresh=1&seed=1`, this neither resets those accounts nor loads
 * dev_snapshot.php (real data). On the deployed site:
 *
 *   /artisan-migrate?token=<TOKEN>&seed=1&class=DemoResetSeeder
 *
 * Every session and API token is cleared, so everyone signs in again.
 */
class DemoResetSeeder extends Seeder
{
    /** email => default password, used only if an account is missing. */
    private const KEEP = [
        'admin@university.edu' => ['System Admin', 'admin', 'admin123'],
        'coach@university.edu' => ['Head Coach', 'coach', 'coach123'],
        'athlete@university.edu' => ['Star Athlete', 'athlete', 'athlete123'],
        'judge@university.edu' => ['Expert Judge', 'judge', 'judge123'],
    ];

    /** Password for every generated demo account. */
    private const DEMO_PASSWORD = 'demo1234';

    private const COLLEGES = [
        'CICS' => ['College of Informatics and Computing Sciences', ['BS Information Technology', 'BS Computer Science']],
        'CTE' => ['College of Teacher Education', ['Bachelor of Secondary Education', 'Bachelor of Physical Education']],
        'CAS' => ['College of Arts and Sciences', ['BS Psychology', 'BA Communication']],
        'CABEIHM' => ['College of Accountancy, Business, Economics, and International Hospitality Management', ['BS Accountancy', 'BS Hospitality Management']],
        'CONAHS' => ['College of Nursing and Allied Health Sciences', ['BS Nursing', 'BS Nutrition and Dietetics']],
        'CCJE' => ['College of Criminal Justice Education', ['BS Criminology']],
    ];

    private const FIRST_M = ['John Paul', 'Mark Anthony', 'Christian', 'Kenneth', 'Jericho', 'Rafael', 'Joshua', 'Carlo', 'Nathaniel', 'Adrian', 'Vincent', 'Gabriel', 'Ivan', 'Lorenzo', 'Miguel', 'Justin', 'Aldrin', 'Paolo'];

    private const FIRST_F = ['Angelica', 'Kristine', 'Mikaela', 'Patricia', 'Bea', 'Janine', 'Czarina', 'Andrea', 'Denise', 'Camille', 'Sofia', 'Trisha', 'Nicole', 'Hannah', 'Ella'];

    private const LAST = ['Dela Cruz', 'Macaraig', 'Panganiban', 'Dimaculangan', 'Ilagan', 'Marasigan', 'Atienza', 'Mendoza', 'Villanueva', 'Castillo', 'Bautista', 'Hernandez', 'Aguilar', 'Magsino', 'Perez', 'Garcia', 'Katigbak', 'Lualhati', 'Umali', 'Comia', 'De Castro', 'Rosales'];

    private string $pw;

    private int $srSeq = 21000;

    private int $nameSeq = 0;

    /** @var array<string,string> college name => department id */
    private array $deptIds = [];

    /** @var array<string,string> category name => id */
    private array $catIds = [];

    /** @var array<string,string> venue name => id */
    private array $venueIds = [];

    /** @var array<string,object> email => user row */
    private array $kept = [];

    private string $seasonId;

    public function run(): void
    {
        $this->pw = Hash::make(self::DEMO_PASSWORD);

        AuditLog::withoutRecording(function () {
            $keptRows = $this->snapshotKeptUsers();

            $this->wipe($keptRows);

            $this->seedDepartments();
            $this->seedCategories();
            $ref = new ReferenceDataSeeder;
            $ref->seedRacquetDisciplines();
            $ref->seedDefaultRequirementTypes();
            $ref->seedDefaultSeason();
            $this->catIds = DB::table('categories')->pluck('id', 'name')->all();
            $this->linkRacquetParents();
            $this->seasonId = DB::table('seasons')->where('is_active', true)->value('id');
            $this->seedVenues();
            $this->relinkKeptUsers();

            $coaches = $this->seedStaff();
            $rosters = $this->seedAthletes($coaches);
            $this->seedRegistration($coaches);

            $this->seedCompetition();
            $this->seedCoachWork($coaches, $rosters);
        });

        Cache::flush();
    }

    // ── Wipe ────────────────────────────────────────────────────────────

    /**
     * The four test accounts as they are right now, also written to disk
     * BEFORE anything is deleted. TRUNCATE can't be rolled back in MySQL, so
     * if a run dies after the wipe, the next run restores the accounts from
     * this file (same ids, same password hashes) instead of finding them gone
     * and recreating them with default passwords.
     */
    private function snapshotKeptUsers(): array
    {
        $path = 'demo-reset/kept-users.json';
        $live = DB::table('users')->whereIn('email', array_keys(self::KEEP))->get()
            ->map(fn ($r) => (array) $r)->keyBy('email')->all();

        $saved = Storage::disk('local')->exists($path)
            ? json_decode(Storage::disk('local')->get($path), true) ?: []
            : [];

        // Live rows win; the file only fills in accounts a failed run lost.
        $rows = array_merge($saved, $live);
        Storage::disk('local')->put($path, json_encode($rows, JSON_PRETTY_PRINT));

        return array_values($rows);
    }

    private function wipe(array $keptRows): void
    {
        $tables = array_map(
            fn ($row) => array_values((array) $row)[0],
            DB::select('SHOW TABLES'),
        );

        Schema::disableForeignKeyConstraints();
        try {
            foreach ($tables as $table) {
                if ($table !== 'migrations') {
                    DB::table($table)->truncate();
                }
            }
            // Restored while FK checks are still off: the athlete account
            // references the coach account, and insert order isn't guaranteed.
            $this->restoreKeptUsers($keptRows);
        } finally {
            Schema::enableForeignKeyConstraints();
        }

        Storage::disk('public')->deleteDirectory('requirements/demo');
    }

    private function restoreKeptUsers(array $rows): void
    {
        foreach ($rows as $data) {
            // Their old college link pointed at a row that no longer exists;
            // relinkKeptUsers() re-points it once colleges are reseeded.
            $data['department_id'] = null;
            DB::table('users')->insert($data);
            $this->kept[$data['email']] = (object) $data;
        }

        // A test account that was already missing is recreated with its
        // documented default password rather than silently skipped.
        foreach (self::KEEP as $email => [$name, $role, $password]) {
            if (isset($this->kept[$email])) {
                continue;
            }
            $row = [
                'id' => (string) Str::uuid(),
                'email' => $email,
                'password' => Hash::make($password),
                'name' => $name,
                'role' => $role,
                'active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ];
            DB::table('users')->insert($row);
            $this->kept[$email] = (object) $row;
        }

        foreach ($this->kept as $email => $row) {
            $this->kept[$email] = DB::table('users')->where('id', $row->id)->first();
        }
    }

    // ── Reference data ──────────────────────────────────────────────────

    private function seedDepartments(): void
    {
        foreach (self::COLLEGES as $abbr => [$name]) {
            $id = (string) Str::uuid();
            DB::table('departments')->insert([
                'id' => $id, 'name' => $name, 'abbreviation' => $abbr,
                'created_at' => now(), 'updated_at' => now(),
            ]);
            $this->deptIds[$name] = $id;
        }
    }

    private function seedCategories(): void
    {
        $sports = [
            ['Basketball', 'Men\'s and women\'s basketball.', 'versus'],
            ['Volleyball', 'Indoor volleyball.', 'versus'],
            ['Badminton', 'Singles and doubles lines.', 'versus'],
            ['Table Tennis', 'Singles and doubles lines.', 'versus'],
            ['Sepak Takraw', 'Regu competition.', 'versus'],
            ['Chess', 'Standard and rapid chess.', 'versus'],
            ['Athletics', 'Track and field events.', 'ranked'],
            ['Swimming', 'Pool events.', 'ranked'],
        ];
        foreach ($sports as [$name, $desc, $format]) {
            DB::table('categories')->insert([
                'id' => (string) Str::uuid(), 'name' => $name, 'description' => $desc,
                'format' => $format, 'created_at' => now(), 'updated_at' => now(),
            ]);
        }
    }

    private function linkRacquetParents(): void
    {
        foreach (['Badminton', 'Table Tennis'] as $sport) {
            DB::table('categories')->where('parent_sport', $sport)
                ->update(['parent_id' => $this->catIds[$sport]]);
        }
    }

    private function seedVenues(): void
    {
        $admin = $this->kept['admin@university.edu']->id;
        $venues = [
            ['Joson Gymnasium', 'indoor', 800, ['Basketball', 'Volleyball'], 'Beside the CTE Building'],
            ['Red Floor Court', 'indoor', 250, ['Badminton', 'Table Tennis', 'Sepak Takraw'], 'Student Services Center, ground floor'],
            ['ARASOF Oval', 'outdoor', 1500, ['Athletics'], 'Behind the Administration Building'],
            ['Nasugbu Aquatic Center', 'indoor', 300, ['Swimming'], 'Brgy. Bucana, Nasugbu'],
            ['Student Center Hall', 'indoor', 120, ['Chess'], 'Student Center, 2nd floor'],
        ];
        foreach ($venues as [$name, $type, $cap, $sports, $loc]) {
            $id = (string) Str::uuid();
            DB::table('venues')->insert([
                'id' => $id, 'name' => $name, 'type' => $type, 'capacity' => $cap,
                'sports' => json_encode($sports), 'location' => $loc, 'status' => 'available',
                'created_by' => $admin, 'created_at' => now(), 'updated_at' => now(),
            ]);
            $this->venueIds[$name] = $id;
        }
    }

    private function relinkKeptUsers(): void
    {
        foreach ($this->kept as $row) {
            if ($row->department && isset($this->deptIds[$row->department])) {
                DB::table('users')->where('id', $row->id)
                    ->update(['department_id' => $this->deptIds[$row->department]]);
            }
        }
    }

    // ── People ──────────────────────────────────────────────────────────

    /** @return array<int,array{id:string,name:string,college:string,sports:array}> */
    private function seedStaff(): array
    {
        $coach = $this->kept['coach@university.edu'];
        $coachSports = json_decode((string) $coach->sports, true) ?: array_filter([$coach->sport]) ?: ['Basketball'];
        $coachCollege = $coach->department && isset($this->deptIds[$coach->department])
            ? $coach->department
            : self::COLLEGES['CICS'][0];
        DB::table('users')->where('id', $coach->id)->update([
            'department' => $coachCollege,
            'department_id' => $this->deptIds[$coachCollege],
            'sport' => $coachSports[0],
            'sports' => json_encode(array_values($coachSports)),
            'enrollment_code' => $coach->enrollment_code ?: 'CICS2526',
        ]);

        $coaches = [[
            'id' => $coach->id, 'name' => $coach->name,
            'college' => $coachCollege, 'sports' => array_values($coachSports),
        ]];

        $extra = [
            ['Ma. Cristina Villanueva', 'CTE', ['Volleyball'], 'Women'],
            ['Jerome Panganiban', 'CABEIHM', ['Basketball'], 'Men'],
            ['Rommel Dimaculangan', 'CAS', ['Table Tennis', 'Badminton'], 'Men & Women'],
            ['Kristine Ilagan', 'CAS', ['Athletics'], 'Men & Women'],
            ['Arnel Bautista', 'CCJE', ['Sepak Takraw'], 'Men'],
            ['Liza Marasigan', 'CONAHS', ['Chess', 'Swimming'], 'Men & Women'],
        ];
        foreach ($extra as $i => [$name, $abbr, $sports, $gender]) {
            $id = (string) Str::uuid();
            $college = self::COLLEGES[$abbr][0];
            DB::table('users')->insert([
                'id' => $id,
                'email' => Str::slug(Str::before($name, ' ').' '.Str::afterLast($name, ' '), '.').'@g.batstate-u.edu.ph',
                'password' => $this->pw, 'name' => $name, 'role' => 'coach', 'active' => true,
                'department' => $college, 'department_id' => $this->deptIds[$college],
                'sport' => $sports[0], 'sports' => json_encode($sports), 'gender_category' => $gender,
                'enrollment_code' => $abbr.'-'.strtoupper(Str::substr(Str::slug($sports[0], ''), 0, 4)).($i + 1),
                'created_at' => now()->subMonths(3), 'updated_at' => now()->subMonths(3),
            ]);
            $coaches[] = ['id' => $id, 'name' => $name, 'college' => $college, 'sports' => $sports];
        }

        foreach ($coaches as $c) {
            foreach ($c['sports'] as $sport) {
                if (isset($this->catIds[$sport])) {
                    DB::table('coach_category')->insert(['coach_id' => $c['id'], 'category_id' => $this->catIds[$sport]]);
                }
            }
        }

        foreach (['Engr. Paolo Mendoza', 'Dr. Aileen Castillo'] as $name) {
            DB::table('users')->insert([
                'id' => (string) Str::uuid(),
                'email' => Str::slug(Str::afterLast($name, '. '), '.').'.judge@g.batstate-u.edu.ph',
                'password' => $this->pw, 'name' => $name, 'role' => 'judge', 'active' => true,
                'created_at' => now()->subMonths(2), 'updated_at' => now()->subMonths(2),
            ]);
        }

        return $coaches;
    }

    /** @return array<string,array<int,array{id:string,name:string,sport:string}>> coach id => roster */
    private function seedAthletes(array $coaches): array
    {
        $rosters = [];

        foreach ($coaches as $i => $c) {
            $abbr = array_search($c['college'], array_map(fn ($x) => $x[0], self::COLLEGES), true) ?: 'CICS';
            $courses = self::COLLEGES[$abbr][1];
            $size = $i === 0 ? 9 : 4;
            $rosters[$c['id']] = [];

            for ($n = 0; $n < $size; $n++) {
                $sport = $c['sports'][$n % count($c['sports'])];
                $female = in_array($c['name'], ['Ma. Cristina Villanueva'], true) || $n % 3 === 2;
                $rosters[$c['id']][] = $this->createAthlete($c, $sport, $female, $courses[$n % count($courses)], $n);
            }
        }

        // The athlete test account joins the test coach's roster.
        $coach = $coaches[0];
        $a = $this->kept['athlete@university.edu'];
        $college = $a->department && isset($this->deptIds[$a->department]) ? $a->department : $coach['college'];
        $sport = in_array($a->sport, $coach['sports'], true) ? $a->sport : $coach['sports'][0];
        [$first, $last] = $this->splitName($a->name);
        DB::table('users')->where('id', $a->id)->update([
            'department' => $college, 'department_id' => $this->deptIds[$college],
            'sport' => $sport, 'sports' => json_encode([$sport]),
            'coach_id' => $coach['id'], 'coach_name' => $coach['name'],
            'year_level' => $a->year_level ?: '3rd Year',
            'course' => $a->course ?: 'BS Information Technology',
            'enrolled_at' => $a->enrolled_at ?: now()->subMonths(2),
        ]);
        DB::table('athletes')->insert([
            'id' => $a->id, 'user_id' => $a->id,
            'student_id' => $a->sr_code ?: '23-20001', 'first_name' => $first, 'last_name' => $last,
            'email' => $a->email, 'department' => $college,
            'year_level' => $a->year_level ?: '3rd Year', 'course' => $a->course ?: 'BS Information Technology',
            'coach_id' => $coach['id'], 'sport' => $sport, 'category_id' => $this->catIds[$sport] ?? null,
            'status' => 'active',
            'emergency_contact' => $a->emergency_contact ?: json_encode(['name' => 'Maria '.$last, 'relationship' => 'Parent', 'phone' => '+639171234567']),
            'enrolled_via_code' => true, 'enrolled_at' => now()->subMonths(2),
            'created_at' => now()->subMonths(2), 'updated_at' => now()->subMonths(2),
        ]);
        array_unshift($rosters[$coach['id']], ['id' => $a->id, 'name' => $a->name, 'sport' => $sport]);

        // Enrolled students who haven't signed up yet — so athlete signup
        // (verified against this registry) can be demoed.
        for ($n = 0; $n < 12; $n++) {
            $abbr = array_keys(self::COLLEGES)[$n % count(self::COLLEGES)];
            $female = $n % 2 === 1;
            [$first, $last] = $this->nextName($female);
            DB::table('campus_students')->insert([
                'sr_code' => $this->nextSr(), 'first_name' => $first, 'last_name' => $last,
                'gender' => $female ? 'Female' : 'Male', 'college' => self::COLLEGES[$abbr][0],
                'program' => self::COLLEGES[$abbr][1][0], 'year_level' => (1 + $n % 4).$this->ordinal(1 + $n % 4).' Year',
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return $rosters;
    }

    private function createAthlete(array $coach, string $sport, bool $female, string $course, int $n): array
    {
        [$first, $last] = $this->nextName($female);
        $sr = $this->nextSr();
        $id = (string) Str::uuid();
        $year = (1 + $n % 4).$this->ordinal(1 + $n % 4).' Year';
        $email = $sr.'@g.batstate-u.edu.ph';
        $enrolled = now()->subDays(30 + $n * 3);
        $contact = json_encode(['name' => ($female ? 'Rosario ' : 'Ernesto ').$last, 'relationship' => 'Parent', 'phone' => '+63917'.str_pad((string) (1000000 + $n * 7919 % 8999999), 7, '0')]);

        DB::table('users')->insert([
            'id' => $id, 'email' => $email, 'sr_code' => $sr, 'gender' => $female ? 'Female' : 'Male',
            'student_verified_at' => $enrolled, 'password' => $this->pw, 'name' => "$first $last",
            'role' => 'athlete', 'active' => true,
            'department' => $coach['college'], 'department_id' => $this->deptIds[$coach['college']],
            'year_level' => $year, 'course' => $course, 'phone' => '+63918'.random_int(1000000, 9999999),
            'emergency_contact' => $contact, 'sport' => $sport, 'sports' => json_encode([$sport]),
            'coach_id' => $coach['id'], 'coach_name' => $coach['name'], 'enrolled_at' => $enrolled,
            'privacy_notice_accepted_at' => $enrolled, 'privacy_notice_version' => '2026-09-21',
            'created_at' => $enrolled, 'updated_at' => $enrolled,
        ]);
        DB::table('athletes')->insert([
            'id' => $id, 'user_id' => $id, 'student_id' => $sr, 'first_name' => $first, 'last_name' => $last,
            'email' => $email, 'department' => $coach['college'], 'year_level' => $year, 'course' => $course,
            'coach_id' => $coach['id'], 'sport' => $sport, 'category_id' => $this->catIds[$sport] ?? null,
            'status' => $n === 7 ? 'injured' : 'active', 'emergency_contact' => $contact,
            'enrolled_via_code' => true, 'enrolled_at' => $enrolled,
            'created_at' => $enrolled, 'updated_at' => $enrolled,
        ]);
        DB::table('campus_students')->insert([
            'sr_code' => $sr, 'first_name' => $first, 'last_name' => $last, 'gender' => $female ? 'Female' : 'Male',
            'college' => $coach['college'], 'program' => $course, 'year_level' => $year, 'email' => $email,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return ['id' => $id, 'name' => "$first $last", 'sport' => $sport];
    }

    private function seedRegistration(array $coaches): void
    {
        $admin = $this->kept['admin@university.edu']->id;
        $codes = [
            ['ADMIN001', 'admin', 'Default Admin Code', 'admin@university.edu'],
            ['COACH001', 'coach', 'Default Coach Code', 'coach@university.edu'],
            ['ATHL001', 'athlete', 'Default Athlete Code', 'athlete@university.edu'],
            ['JUDGE001', 'judge', 'Default Committee Code', 'judge@university.edu'],
        ];
        foreach ($codes as [$code, $role, $label, $email]) {
            DB::table('registration_codes')->insert([
                'code' => $code, 'role' => $role, 'label' => $label, 'used' => true,
                'used_by' => $this->kept[$email]->id, 'created_by' => $admin, 'used_at' => now()->subMonths(3),
                'created_at' => now()->subMonths(3), 'updated_at' => now()->subMonths(3),
            ]);
        }
        foreach ([
            ['COACH-2526-A', 'coach', 'New coaches — 2025–2026 season', 60],
            ['COMM-2526-A', 'judge', 'Intramurals scoring committee', 30],
            ['COMM-2526-B', 'judge', 'Athletics meet officials', -3],
        ] as [$code, $role, $label, $days]) {
            DB::table('registration_codes')->insert([
                'code' => $code, 'role' => $role, 'label' => $label, 'used' => false,
                'created_by' => $admin, 'expires_at' => now()->addDays($days),
                'created_at' => now()->subDays(10), 'updated_at' => now()->subDays(10),
            ]);
        }
    }

    // ── Competition ─────────────────────────────────────────────────────

    private function seedCompetition(): void
    {
        $service = app(BracketService::class);
        $admin = $this->kept['admin@university.edu']->id;
        $c = fn (string $abbr) => self::COLLEGES[$abbr][0];
        $today = Carbon::today();

        // Basketball — six colleges (byes in round 1), played through the
        // semis; the final is next week.
        $this->playBracket($service, $admin, [
            'sport' => 'Basketball', 'format' => 'single_elimination',
            'participants' => [$c('CICS'), $c('CCJE'), $c('CABEIHM'), $c('CTE'), $c('CAS'), $c('CONAHS')],
            'startDate' => $today->copy()->subDays(9)->toDateString(), 'startTime' => '08:00',
            'matchDuration' => 90, 'breakDuration' => 30, 'venueId' => $this->venueIds['Joson Gymnasium'],
        ], leaveFinal: true, finalDate: $today->copy()->addDays(5));

        // Volleyball — semis done, final is being played right now.
        $bracket = $this->playBracket($service, $admin, [
            'sport' => 'Volleyball', 'format' => 'single_elimination',
            'participants' => [$c('CTE'), $c('CAS'), $c('CONAHS'), $c('CABEIHM')],
            'startDate' => $today->copy()->subDays(6)->toDateString(), 'startTime' => '13:00',
            'matchDuration' => 90, 'breakDuration' => 30, 'venueId' => $this->venueIds['Joson Gymnasium'],
        ], leaveFinal: true, finalDate: $today->copy());
        $this->goLive($bracket, 2, 1, 'Set 4');

        // Sepak Takraw — round robin, half the fixtures played.
        $this->playBracket($service, $admin, [
            'sport' => 'Sepak Takraw', 'format' => 'round_robin',
            'participants' => [$c('CCJE'), $c('CICS'), $c('CAS'), $c('CTE')],
            'startDate' => $today->copy()->subDays(4)->toDateString(), 'startTime' => '09:00',
            'matchDuration' => 60, 'breakDuration' => 15, 'venueId' => $this->venueIds['Red Floor Court'],
        ], playCount: 3);

        // Badminton M Singles A — drawn and published, not yet played.
        $this->playBracket($service, $admin, [
            'sport' => 'Badminton — M Singles A', 'format' => 'single_elimination',
            'participants' => [$c('CICS'), $c('CAS'), $c('CABEIHM'), $c('CCJE')],
            'startDate' => $today->copy()->addDays(3)->toDateString(), 'startTime' => '09:00',
            'matchDuration' => 45, 'breakDuration' => 15, 'venueId' => $this->venueIds['Red Floor Court'],
        ], playCount: 0);

        // Table Tennis W Singles A — drawn, still a draft.
        $service->generate([
            'sport' => 'Table Tennis — W Singles A', 'format' => 'single_elimination',
            'participants' => [$c('CAS'), $c('CONAHS'), $c('CICS'), $c('CTE')],
            'startDate' => $today->copy()->addDays(8)->toDateString(), 'startTime' => '13:00',
            'matchDuration' => 45, 'breakDuration' => 15, 'venueId' => $this->venueIds['Red Floor Court'],
        ], $admin);

        // Ranked events: a finished athletics final and an upcoming swim meet.
        $all = array_map(fn ($x) => $x[0], array_values(self::COLLEGES));
        $dash = $this->standaloneEvent('Athletics — 100m Dash (Men) Final', 'Athletics', $today->copy()->subDays(5), '07:30', '08:30', 'ARASOF Oval', $all, 'completed', ['Time', 'Form']);
        $judges = DB::table('users')->where('role', 'judge')->get();
        $base = [9.6, 9.2, 8.8, 8.5, 8.1, 7.6];
        foreach ($all as $k => $dept) {
            foreach ($judges->take(2) as $j => $judge) {
                $total = round($base[$k] - $j * 0.1, 2);
                Score::create([
                    'id' => (string) Str::uuid(), 'event_id' => $dash->id, 'department' => $dept,
                    'judge_id' => $judge->id, 'judge_name' => $judge->name,
                    'scores' => ['Time' => $total, 'Form' => $total], 'total_score' => $total,
                    'status' => 'official', 'submitted_via_qr' => $j === 0, 'method' => $j === 0 ? 'manual' : 'ocr',
                ]);
            }
        }
        ScoreController::recalculateRankings($dash->id);

        $this->standaloneEvent('Swimming — 50m Freestyle (Women)', 'Swimming', $today->copy()->addDays(10), '08:00', '10:00', 'Nasugbu Aquatic Center', $all, 'upcoming', ['Time']);
        $this->standaloneEvent('Chess — Rapid Team Championship', 'Chess', $today->copy()->addDays(2), '13:00', '17:00', 'Student Center Hall', $all, 'upcoming', []);

        // Protests on played games.
        $coach = $this->kept['coach@university.edu']->id;
        $played = Event::where('status', 'completed')->where('category', 'Basketball')->orderBy('schedule')->get();
        if ($played->count() >= 2) {
            DB::table('protests')->insert([
                ['id' => (string) Str::uuid(), 'event_id' => $played[0]->id, 'season_id' => $this->seasonId, 'filed_by' => $coach,
                    'department' => $c('CICS'), 'reason' => 'The shot clock was not reset after an offensive rebound with 1:12 left in the 4th quarter; the resulting possession decided the game.',
                    'status' => 'open', 'resolution' => null, 'resolved_by' => null, 'resolved_at' => null,
                    'created_at' => now()->subDays(8), 'updated_at' => now()->subDays(8)],
                ['id' => (string) Str::uuid(), 'event_id' => $played[1]->id, 'season_id' => $this->seasonId, 'filed_by' => $coach,
                    'department' => $c('CICS'), 'reason' => 'An ineligible player (no approved clearance) was fielded by the opposing team in the 2nd half.',
                    'status' => 'dismissed', 'resolution' => 'Records show the player was cleared on Sept 12. Result stands.',
                    'resolved_by' => $this->kept['admin@university.edu']->id, 'resolved_at' => now()->subDays(6),
                    'created_at' => now()->subDays(7), 'updated_at' => now()->subDays(6)],
            ]);
        }
    }

    /**
     * Generate + publish a bracket through the real BracketService, then
     * record results for the first playable matches the same way the live
     * scoring path does (TeamMatch -> advanceFromEvent).
     */
    private function playBracket(BracketService $service, string $admin, array $cfg, bool $leaveFinal = false, ?Carbon $finalDate = null, ?int $playCount = null)
    {
        $bracket = $service->generate($cfg, $admin);
        $service->publish($bracket->fresh('matches'));

        $played = 0;
        $maxRound = (int) BracketMatch::where('bracket_id', $bracket->id)->max('round');

        while (true) {
            $next = BracketMatch::where('bracket_id', $bracket->id)
                ->where('is_bye', false)->where('status', '!=', 'completed')
                ->whereNotNull('home_team')->whereNotNull('away_team')->whereNotNull('event_id')
                ->orderBy('round')->orderBy('slot')->first();

            if (! $next) {
                break;
            }
            if ($playCount !== null && $played >= $playCount) {
                break;
            }
            if ($leaveFinal && $cfg['format'] === 'single_elimination' && $next->round === $maxRound) {
                break;
            }

            $this->recordResult($next, $played);
            $played++;
        }

        // Anything left unplayed but dated in the past would read as a
        // forgotten game — move it onto the coming days instead.
        $pending = BracketMatch::where('bracket_id', $bracket->id)->where('is_bye', false)
            ->where('status', '!=', 'completed')->where('scheduled_date', '<', Carbon::today()->toDateString())
            ->orderBy('round')->orderBy('slot')->get();
        foreach ($pending as $k => $bm) {
            $date = Carbon::today()->addDays(1 + $k)->toDateString();
            $bm->update(['scheduled_date' => $date]);
            if ($bm->event_id) {
                Event::whereKey($bm->event_id)->update(['schedule' => $date]);
            }
        }

        if ($finalDate) {
            $final = BracketMatch::where('bracket_id', $bracket->id)->where('round', $maxRound)->first();
            if ($final) {
                $final->update(['scheduled_date' => $finalDate->toDateString(), 'scheduled_time' => '15:00']);
                if ($final->event_id) {
                    Event::whereKey($final->event_id)->update([
                        'schedule' => $finalDate->toDateString(), 'start_time' => '15:00', 'end_time' => '16:30',
                    ]);
                }
            }
        }

        return $bracket->fresh('matches');
    }

    private function recordResult(BracketMatch $bm, int $seed): void
    {
        $event = Event::find($bm->event_id);
        [$home, $away] = $this->scoreline($event->category, $seed);

        LiveScore::create([
            'id' => (string) Str::uuid(), 'event_id' => $event->id, 'sport' => $event->category,
            'home_team' => $bm->home_team, 'away_team' => $bm->away_team,
            'home_score' => $home, 'away_score' => $away, 'status' => 'final', 'version' => 1,
            'updated_by' => $this->kept['judge@university.edu']->id,
            'started_at' => Carbon::parse($event->schedule.' '.$event->start_time),
            'finalized_at' => Carbon::parse($event->schedule.' '.$event->end_time),
        ]);

        $match = new TeamMatch([
            'sport' => $event->category, 'stage' => 'elimination', 'event_id' => $event->id,
            'home_team' => $bm->home_team, 'away_team' => $bm->away_team,
            'home_score' => $home, 'away_score' => $away, 'status' => 'completed',
            'played_at' => Carbon::parse($event->schedule.' '.$event->end_time),
            'recorded_by' => $this->kept['judge@university.edu']->id,
        ]);
        $match->id = (string) Str::uuid();
        $match->resolveOutcome();
        $match->save();

        $event->update(['status' => 'completed']);
        app(BracketService::class)->advanceFromEvent($event->id);
    }

    /** Believable, never-drawn scorelines per sport. Home wins on even seeds. */
    private function scoreline(string $sport, int $seed): array
    {
        [$w, $l] = match (true) {
            str_starts_with($sport, 'Basketball') => [[78, 84, 71, 90, 66][$seed % 5], [64, 79, 68, 72, 61][$seed % 5]],
            str_starts_with($sport, 'Volleyball') => [3, [1, 0, 2][$seed % 3]],
            str_starts_with($sport, 'Sepak Takraw') => [2, [0, 1][$seed % 2]],
            default => [2, 1],
        };

        return $seed % 2 === 0 ? [$w, $l] : [$l, $w];
    }

    private function goLive($bracket, int $home, int $away, string $period): void
    {
        $final = $bracket->matches->sortByDesc('round')->first();
        if (! $final || ! $final->event_id || ! $final->home_team || ! $final->away_team) {
            return;
        }
        Event::whereKey($final->event_id)->update(['status' => 'ongoing', 'start_time' => now()->subMinutes(50)->format('H:i')]);
        LiveScore::create([
            'id' => (string) Str::uuid(), 'event_id' => $final->event_id, 'sport' => $bracket->sport,
            'home_team' => $final->home_team, 'away_team' => $final->away_team,
            'home_score' => $home, 'away_score' => $away, 'period' => $period, 'status' => 'in_progress',
            'version' => 12, 'updated_by' => $this->kept['judge@university.edu']->id,
            'started_at' => now()->subMinutes(50),
        ]);
    }

    private function standaloneEvent(string $name, string $category, Carbon $date, string $start, string $end, string $venue, array $depts, string $status, array $criteria): Event
    {
        return Event::create([
            'id' => (string) Str::uuid(), 'name' => $name, 'category' => $category,
            'schedule' => $date->toDateString(), 'start_time' => $start, 'end_time' => $end,
            'venue_id' => $this->venueIds[$venue], 'venue_name' => $venue,
            'departments' => $depts,
            'judges' => DB::table('users')->where('role', 'judge')->limit(2)->get(['id', 'name', 'email'])
                ->map(fn ($j) => (array) $j)->all(),
            'criteria' => array_map(fn ($c) => ['name' => $c, 'weight' => intdiv(100, max(1, count($criteria)))], $criteria),
            'status' => $status, 'qr_token' => Str::random(32),
        ]);
    }

    // ── Coach-side records ──────────────────────────────────────────────

    private function seedCoachWork(array $coaches, array $rosters): void
    {
        $coach = $coaches[0];
        $roster = $rosters[$coach['id']];
        $athleteUser = $this->kept['athlete@university.edu'];

        $this->seedAnnouncements($coaches);
        $this->seedAttendance($coach, $roster);
        $this->seedAttendance($coaches[1], $rosters[$coaches[1]['id']], sessions: 2);
        $this->seedPerformance($coach, $roster);
        $this->seedRequirements($coach, $roster);
        $this->seedLineup($coach, $roster);

        $now = now();
        $notify = function (string $userId, string $type, array $data, ?Carbon $readAt, Carbon $at) {
            DB::table('notifications')->insert([
                'id' => (string) Str::uuid(), 'type' => $type, 'notifiable_type' => 'App\\Models\\User',
                'notifiable_id' => $userId, 'data' => json_encode($data), 'read_at' => $readAt,
                'created_at' => $at, 'updated_at' => $at,
            ]);
        };
        $notify($athleteUser->id, 'App\\Notifications\\RequirementReviewed', ['kind' => 'requirement_reviewed', 'title' => 'Requirement approved', 'body' => '"Waiver Form" was approved.', 'url' => '/athlete/requirements'], $now->copy()->subDays(4), $now->copy()->subDays(5));
        $notify($athleteUser->id, 'App\\Notifications\\RequirementReviewed', ['kind' => 'requirement_reviewed', 'title' => 'Requirement approved', 'body' => '"Certificate of Enrollment" was approved.', 'url' => '/athlete/requirements'], null, $now->copy()->subDays(2));
        $notify($athleteUser->id, 'App\\Notifications\\RequirementReviewed', ['kind' => 'requirement_reviewed', 'title' => 'Requirement returned', 'body' => '"Parental Consent" needs your guardian\'s signature. Download the blank form, sign, and resubmit.', 'url' => '/athlete/requirements'], null, $now->copy()->subHours(6));
        $notify($coach['id'], 'App\\Notifications\\ProtestResolved', ['kind' => 'protest_resolved', 'title' => 'Protest dismissed', 'body' => 'Your protest about the Basketball semi-final was dismissed.', 'url' => '/coach/protests'], null, $now->copy()->subDays(6));
        $notify($this->kept['admin@university.edu']->id, 'App\\Notifications\\ProtestFiled', ['kind' => 'protest_filed', 'title' => 'New protest', 'body' => self::COLLEGES['CICS'][0].' protested a Basketball game.', 'url' => '/admin/protests'], null, $now->copy()->subDays(8));
    }

    private function seedAnnouncements(array $coaches): void
    {
        $coach = $coaches[0];
        $tryoutId = (string) Str::uuid();
        $rows = [
            [$tryoutId, 'Basketball Varsity Tryouts — CICS', "Open to all CICS students. Bring your PE uniform, rubber shoes, and a copy of your COR.\n\nDate: Oct 2, 4:00 PM\nVenue: Joson Gymnasium", true, 'Basketball', $coach, 12],
            [(string) Str::uuid(), 'Training moved to 5:00 PM this week', 'Because of the college assembly, Tuesday and Thursday training starts at 5:00 PM. Please be on time for the warm-up.', false, 'Basketball', $coach, 3],
            [(string) Str::uuid(), 'Submit your Medical Clearance before the final', 'Athletes without an approved Medical Clearance cannot be listed on the final line-up. Upload it under CMO Requirements.', false, 'Basketball', $coach, 1],
            [(string) Str::uuid(), 'Volleyball Women — Tryouts', 'Looking for setters and liberos. Tryouts on Oct 4, 8:00 AM, Joson Gymnasium.', true, 'Volleyball', $coaches[1], 9],
            [(string) Str::uuid(), 'Athletics time trials', 'Sprint and middle-distance time trials every Saturday, 6:00 AM at the ARASOF Oval.', false, 'Athletics', $coaches[4], 5],
        ];
        foreach ($rows as [$id, $title, $content, $tryout, $sport, $c, $days]) {
            DB::table('announcements')->insert([
                'id' => $id, 'title' => $title, 'content' => $content, 'is_tryout' => $tryout, 'sport' => $sport,
                'coach_id' => $c['id'], 'coach_name' => $c['name'],
                'created_at' => now()->subDays($days), 'updated_at' => now()->subDays($days),
            ]);
        }

        foreach ([['pending', 1], ['pending', 2], ['accepted', 4], ['rejected', 6], ['accepted', 7]] as $k => [$status, $days]) {
            [$first, $last] = $this->nextName($k % 2 === 1);
            $sr = $this->nextSr();
            DB::table('tryout_applications')->insert([
                'id' => (string) Str::uuid(), 'announcement_id' => $tryoutId, 'sport' => 'Basketball',
                'coach_id' => $coach['id'], 'first_name' => $first, 'last_name' => $last,
                'email' => $sr.'@g.batstate-u.edu.ph', 'student_id' => $sr, 'department' => 'CICS',
                'phone' => '+63927'.random_int(1000000, 9999999), 'year_level' => (1 + $k % 3).$this->ordinal(1 + $k % 3).' Year',
                'status' => $status, 'applied_at' => now()->subDays($days),
                'created_at' => now()->subDays($days), 'updated_at' => now()->subDays($days),
            ]);
        }
    }

    private function seedAttendance(array $coach, array $roster, int $sessions = 5): void
    {
        $pattern = ['present', 'present', 'present', 'late', 'present', 'excused', 'present', 'absent', 'present', 'present'];
        for ($s = 0; $s < $sessions; $s++) {
            $date = now()->subDays(2 + $s * 3)->toDateString();
            $sid = (string) Str::uuid();
            DB::table('attendance_sessions')->insert([
                'id' => $sid, 'coach_id' => $coach['id'], 'title' => $s % 2 === 0 ? 'Training' : 'Conditioning',
                'date' => $date, 'created_by' => $coach['id'], 'created_at' => $date, 'updated_at' => $date,
            ]);
            foreach ($roster as $k => $athlete) {
                DB::table('attendance_records')->insert([
                    'id' => (string) Str::uuid(), 'session_id' => $sid, 'athlete_id' => $athlete['id'],
                    'event_id' => 'training', 'date' => $date,
                    'status' => $pattern[($k + $s * 3) % count($pattern)],
                    'recorded_by' => $coach['id'], 'recorded_at' => $date.' 18:00:00',
                    'created_at' => $date, 'updated_at' => $date,
                ]);
            }
        }
    }

    private function seedPerformance(array $coach, array $roster): void
    {
        $games = Event::where('category', 'Basketball')->where('status', 'completed')->orderBy('schedule')->get();
        $notes = [
            'Great court vision; pushed the pace in transition all game.',
            'Solid on-ball defense. Needs to be quicker closing out on shooters.',
            'Led the second-half run. Free-throw shooting still inconsistent.',
            'Rebounded well on both ends; keep working on the weak hand.',
            'Composed under pressure; good decision-making in the last two minutes.',
        ];
        $i = 0;
        foreach ($roster as $athlete) {
            if ($athlete['sport'] !== 'Basketball') {
                continue;
            }
            foreach ($games as $g => $game) {
                $rating = [8, 7, 9, 6, 8, 7][($i + $g) % 6];
                DB::table('performance_records')->insert([
                    'id' => (string) Str::uuid(), 'athlete_id' => $athlete['id'], 'athlete_name' => $athlete['name'],
                    'event_id' => $game->id, 'event_name' => $game->name, 'sport' => 'Basketball',
                    'metrics' => json_encode(['points' => 4 + ($i * 5 + $g * 3) % 19, 'rebounds' => 1 + ($i + $g) % 9, 'assists' => ($i * 2 + $g) % 7, 'steals' => ($i + $g) % 4]),
                    'overall_rating' => $rating, 'coach_notes' => $notes[($i + $g) % count($notes)],
                    'recorded_by' => $coach['id'], 'recorded_at' => Carbon::parse($game->schedule)->setTime(19, 0),
                    'created_at' => Carbon::parse($game->schedule), 'updated_at' => Carbon::parse($game->schedule),
                ]);
            }
            $i++;
        }
    }

    private function seedRequirements(array $coach, array $roster): void
    {
        $pdf = 'requirements/demo/sample-document.pdf';
        Storage::disk('public')->put($pdf, $this->samplePdf());
        $url = Storage::url($pdf);

        $types = DB::table('requirement_types')->orderBy('name')->get()->keyBy('name');
        // Per athlete: which checklist items are in, and their state.
        $states = [
            ['Waiver Form' => 'approved', 'Certificate of Enrollment' => 'approved', 'Medical Clearance' => 'pending'],
            ['Waiver Form' => 'approved', 'Certificate of Enrollment' => 'approved', 'Medical Clearance' => 'approved', 'Parental Consent' => 'approved'],
            ['Waiver Form' => 'pending', 'Certificate of Enrollment' => 'rejected'],
            ['Waiver Form' => 'approved', 'Certificate of Enrollment' => 'approved', 'Medical Clearance' => 'approved', 'Parental Consent' => 'approved'],
            ['Waiver Form' => 'approved', 'Medical Clearance' => 'rejected'],
            ['Certificate of Enrollment' => 'pending'],
        ];
        $rejectNote = [
            'Certificate of Enrollment' => 'This is last semester\'s COR — please upload the current one.',
            'Medical Clearance' => 'Missing the physician\'s signature and license number.',
        ];

        foreach ($roster as $k => $athlete) {
            foreach ($states[$k % count($states)] as $name => $status) {
                $at = now()->subDays(10 - ($k % 6));
                DB::table('requirements')->insert([
                    'id' => (string) Str::uuid(), 'athlete_id' => $athlete['id'], 'athlete_name' => $athlete['name'],
                    'type' => 'checklist', 'requirement_type_id' => $types[$name]->id ?? null, 'name' => $name,
                    'file_url' => $url, 'status' => $status, 'notes' => $status === 'rejected' ? ($rejectNote[$name] ?? 'Unreadable scan — please resubmit.') : null,
                    'reviewed_by' => $status === 'pending' ? null : $coach['id'],
                    'reviewed_at' => $status === 'pending' ? null : $at->copy()->addDay(),
                    'submitted_at' => $at, 'created_at' => $at, 'updated_at' => $at,
                ]);
            }
        }
    }

    private function seedLineup(array $coach, array $roster): void
    {
        $badminton = array_values(array_filter($roster, fn ($a) => $a['sport'] === 'Badminton'));
        $lines = ['Badminton — M Singles A', 'Badminton — M Singles B', 'Badminton — M Doubles', 'Badminton — M Doubles'];
        foreach ($badminton as $k => $athlete) {
            if (! isset($lines[$k])) {
                break;
            }
            DB::table('discipline_entries')->insert([
                'id' => (string) Str::uuid(), 'category' => $lines[$k], 'department' => $coach['college'],
                'athlete_id' => $athlete['id'], 'athlete_name' => $athlete['name'], 'coach_id' => $coach['id'],
                'pair_slot' => str_contains($lines[$k], 'Doubles') ? ($k === 2 ? 'C' : 'D') : null,
                'created_at' => now()->subDays(6), 'updated_at' => now()->subDays(6),
            ]);
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────

    private function nextName(bool $female): array
    {
        $pool = $female ? self::FIRST_F : self::FIRST_M;
        $n = $this->nameSeq++;

        return [$pool[$n % count($pool)], self::LAST[($n * 7) % count(self::LAST)]];
    }

    private function nextSr(): string
    {
        $n = $this->srSeq++;

        return sprintf('%02d-%05d', 21 + $n % 5, $n);
    }

    private function splitName(string $name): array
    {
        $parts = preg_split('/\s+/', trim($name));
        $last = count($parts) > 1 ? array_pop($parts) : 'Athlete';

        return [implode(' ', $parts) ?: $name, $last];
    }

    private function ordinal(int $n): string
    {
        return [1 => 'st', 2 => 'nd', 3 => 'rd'][$n] ?? 'th';
    }

    /** A tiny valid one-page PDF so "View file" links open something real. */
    private function samplePdf(): string
    {
        $text = 'SportAxis demo document - sample upload';
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
