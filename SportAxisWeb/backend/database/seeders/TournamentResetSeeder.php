<?php

namespace Database\Seeders;

use App\Models\AuditLog;
use App\Models\Event;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * DESTRUCTIVE. Resets the site to a fresh intramurals with a full set of test
 * accounts, keeping the admin.
 *
 * Kept as they are: every admin account (and its sign-in), the colleges (with
 * their logos), venues, seasons, the eligibility checklist, registration
 * codes, the home-page slideshow and the campus student registry.
 * Everything else is wiped — every other account, events, scores, brackets,
 * lineups, announcements, attendance, requirements, notifications, logs.
 *
 * Then it creates, all with the password `demo1234`:
 *   coach1–10@g.batstate-u.edu.ph    one per college, each handling all seven
 *                                    sports for Men & Women
 *   athlete1–1400@g.batstate-u.edu.ph  per coach, per sport: 10 men and 10 women,
 *                                    each with a jersey number, on the campus
 *                                    registry, privacy notice accepted
 *   judge1–10@g.batstate-u.edu.ph    committee members
 * the sports Basketball, Volleyball, Beach Volleyball, Sepak Takraw,
 * Badminton, Table Tennis and Chess (with the racquet sports' Men's and
 * Women's lines), and a sample schedule of upcoming games with judges.
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

    private const COACH_COUNT = 10;

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

    /** Used only if the site has fewer than ten colleges: abbreviation => name. */
    private const DEFAULT_COLLEGES = [
        'CICS' => 'College of Informatics and Computing Sciences',
        'CABEIHM' => 'College of Accountancy, Business, Economics, and International Hospitality Management',
        'CAS' => 'College of Arts and Sciences',
        'CoE' => 'College of Engineering',
        'CTE' => 'College of Teacher Education',
        'CIT' => 'College of Industrial Technology',
        'CONAHS' => 'College of Nursing and Allied Health Sciences',
        'CCJE' => 'College of Criminal Justice Education',
        'CAFAD' => 'College of Architecture, Fine Arts and Design',
        'CHS' => 'College of Health Sciences',
    ];

    private const COACH_NAMES = [
        'Marco Villanueva', 'Joanna Castillo', 'Rafael Dimaculangan', 'Carla Macaraig', 'Dennis Ramirez',
        'Liza Marasigan', 'Arnel Bautista', 'Kristine Ilagan', 'Ramon Atienza', 'Teresa Magsino',
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
            $this->seedSchedule($coaches, $judges);
        });

        Cache::flush();

        $this->command?->info(sprintf(
            'Reset done — coach1–%d, athlete1–%d, judge1–%d %s, password %s',
            self::COACH_COUNT, self::COACH_COUNT * count(self::SPORTS) * 2 * self::PER_TEAM, self::JUDGE_COUNT, self::DOMAIN, self::PASSWORD,
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

    /** Ten colleges: the site's own, in a stable order, topped up if there are fewer. */
    private function colleges(): array
    {
        $existing = DB::table('departments')->orderBy('name')->get(['id', 'name', 'abbreviation']);
        $order = array_keys(self::DEFAULT_COLLEGES);
        $colleges = $existing->sortBy(fn ($d) => [
            ($i = array_search($d->abbreviation, $order, true)) === false ? 99 : $i, $d->name,
        ])->values()->all();

        foreach (self::DEFAULT_COLLEGES as $abbr => $name) {
            if (count($colleges) >= self::COACH_COUNT) {
                break;
            }
            if ($existing->contains(fn ($d) => $d->abbreviation === $abbr || $d->name === $name)) {
                continue;
            }
            $id = (string) Str::uuid();
            DB::table('departments')->insert(['id' => $id, 'name' => $name, 'abbreviation' => $abbr, 'created_at' => now(), 'updated_at' => now()]);
            $colleges[] = (object) ['id' => $id, 'name' => $name, 'abbreviation' => $abbr];
        }

        return array_slice($colleges, 0, self::COACH_COUNT);
    }

    // ── People ──────────────────────────────────────────────────────────

    /** @return array<int, User> coach number => coach */
    private function seedCoaches(array $colleges): array
    {
        $coaches = [];
        foreach ($colleges as $i => $college) {
            $n = $i + 1;
            $coach = new User;
            $coach->forceFill([
                'id' => (string) Str::uuid(),
                'email' => "coach{$n}".self::DOMAIN,
                'password' => $this->password,
                'name' => self::COACH_NAMES[$i],
                'role' => 'coach',
                'active' => true,
                'department' => $college->name,
                'department_id' => $college->id,
                'sport' => array_key_first(self::SPORTS),
                'sports' => array_keys(self::SPORTS),    // coach_category follows (User::syncSportKeys)
                'gender_category' => 'Men & Women',
                'enrollment_code' => Str::upper(Str::slug($college->abbreviation ?: "C{$n}", '')).'-2627',
                'privacy_notice_accepted_at' => now(),
                'privacy_notice_version' => self::PRIVACY_NOTICE_VERSION,
            ])->save();
            $coaches[$n] = $coach;
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
     * athlete1… in order coach → sport → Men, Women. Written in batches: a
     * web request on shared hosting has a time limit, and 1,400 one-by-one
     * saves would run past it.
     */
    private function seedAthletes(array $coaches): void
    {
        $users = $athletes = $registry = [];
        $n = 0;
        $counter = ['Male' => 0, 'Female' => 0];
        $now = now();

        foreach ($coaches as $coach) {
            foreach (array_keys(self::SPORTS) as $sport) {
                foreach (['Male' => 0, 'Female' => self::PER_TEAM] as $gender => $jerseyOffset) {
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

    // ── Sample schedule ─────────────────────────────────────────────────

    /**
     * Upcoming games over the next week: for each sport, a Men's and a
     * Women's round between different colleges, each with a committee member.
     * Badminton and Table Tennis are scheduled on their Singles A lines.
     */
    private function seedSchedule(array $coaches, array $judges): void
    {
        $colleges = array_values(array_map(fn (User $c) => $c->department, $coaches));
        $venues = DB::table('venues')->get(['id', 'name'])->all();
        $slots = [['08:00', '10:00'], ['10:00', '12:00'], ['13:00', '15:00'], ['15:00', '17:00']];
        $game = 0;

        foreach (array_keys(self::SPORTS) as $s => $sport) {
            foreach (['Men' => 'M', 'Women' => 'W'] as $division => $letter) {
                $category = in_array($sport, ['Badminton', 'Table Tennis'], true) ? "{$sport} — {$letter} Singles A" : $sport;
                // Two games per sport and division, each pairing a different set of colleges.
                foreach ([0, 1] as $round) {
                    $a = ($s * 2 + $round * 4 + ($letter === 'W' ? 1 : 0)) % count($colleges);
                    $b = ($a + 1 + $round) % count($colleges);
                    $venue = $venues ? $venues[$game % count($venues)] : null;
                    $judge = $judges[$game % count($judges)];
                    [$start, $end] = $slots[$game % count($slots)];

                    Event::create([
                        'id' => (string) Str::uuid(),
                        'name' => "{$division}'s {$sport}",
                        'category' => $category,
                        'schedule' => now()->addDays(1 + intdiv($game, count($slots)))->toDateString(),
                        'start_time' => $start,
                        'end_time' => $end,
                        'venue_id' => $venue?->id,
                        'venue_name' => $venue?->name ?? 'Main Gymnasium',
                        'departments' => [$colleges[$a], $colleges[$b]],
                        'judges' => [['id' => $judge->id, 'name' => $judge->name, 'email' => $judge->email]],
                        'status' => 'upcoming',
                        'qr_token' => Str::random(32),
                    ]);
                    $game++;
                }
            }
        }
    }
}
