<?php

namespace Database\Seeders;

use App\Models\Athlete;
use App\Models\AuditLog;
use App\Models\CampusStudent;
use App\Models\Category;
use App\Models\Department;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Numbered test accounts for trying the app end to end, all with the password
 * `demo1234`:
 *
 *   coach1–5@g.batstate-u.edu.ph     one per college — CICS, CABEIHM, CAS, CoE,
 *                                    CTE — each coaching Basketball and Volleyball
 *   athlete1–70@g.batstate-u.edu.ph  14 per coach: 7 basketball (five on court
 *                                    plus subs) and 7 volleyball (the rotation's
 *                                    six plus a sub), each with a jersey number.
 *                                    athlete1–5 are CICS Basketball and 6–10
 *                                    CABEIHM Basketball, as they always were.
 *   judge1–5@g.batstate-u.edu.ph     committee members (assign them to games)
 *
 * Athletes are complete like a real signup: verified against the campus
 * registry (a campus_students row), privacy notice accepted, on their coach's
 * roster. Safe to re-run — it creates or updates by email and deletes
 * nothing. Local/dev only: the password is weak and public.
 *
 *   php artisan db:seed --class=TestAccountsSeeder
 */
class TestAccountsSeeder extends Seeder
{
    private const PASSWORD = 'demo1234';

    private const DOMAIN = '@g.batstate-u.edu.ph';

    private const PRIVACY_NOTICE_VERSION = '2026-09-21';

    /** [name, college abbreviation] per coach — every coach a different college. */
    private const COACHES = [
        1 => ['Marco Villanueva', 'CICS'],
        2 => ['Joanna Castillo', 'CABEIHM'],
        3 => ['Rafael Dimaculangan', 'CAS'],
        4 => ['Carla Macaraig', 'CoE'],
        5 => ['Dennis Ramirez', 'CTE'],
    ];

    private const SPORTS = ['Basketball', 'Volleyball'];

    /** Players per coach per sport. */
    private const PER_TEAM = 7;

    /** Jersey numbers handed out in this order, per team. */
    private const JERSEYS = [
        'Basketball' => ['4', '7', '10', '12', '15', '21', '23', '3', '5', '8', '11', '14'],
        'Volleyball' => ['1', '2', '3', '5', '6', '8', '9', '11', '13'],
    ];

    /** The first ten, kept exactly as they were: [first, last, coach, jersey] (basketball). */
    private const FIRST_TEN = [
        1 => ['Paolo', 'Reyes', 1, '4'],
        2 => ['Miguel', 'Santos', 1, '7'],
        3 => ['Josh', 'Cruz', 1, '10'],
        4 => ['Kenneth', 'Dela Paz', 1, '12'],
        5 => ['Adrian', 'Garcia', 1, '15'],
        6 => ['Nico', 'Aquino', 2, '3'],
        7 => ['Rey', 'Ramos', 2, '5'],
        8 => ['Carlo', 'Torres', 2, '8'],
        9 => ['Luis', 'Villa', 2, '11'],
        10 => ['Enzo', 'Castro', 2, '14'],
    ];

    private const MEN = ['Gabriel', 'Rafael', 'Joaquin', 'Andres', 'Mateo', 'Julian', 'Lorenzo', 'Diego', 'Emilio', 'Santi', 'Bryan', 'Jerome', 'Mark', 'Vince', 'Aldrin', 'Cedric', 'Jomar', 'Ivan'];

    private const WOMEN = ['Angela', 'Bea', 'Camille', 'Denise', 'Erika', 'Faith', 'Gwen', 'Hannah', 'Isabel', 'Jasmine', 'Kyla', 'Leah', 'Mika', 'Nicole', 'Patricia', 'Rica', 'Sofia', 'Trisha'];

    private const SURNAMES = ['Abad', 'Bautista', 'Cabrera', 'Dimaano', 'Escueta', 'Fernandez', 'Gonzales', 'Hernandez', 'Ilagan', 'Javier', 'Katigbak', 'Lopez', 'Manalo', 'Navarro', 'Ocampo', 'Panganiban', 'Quinto', 'Rosales', 'Salazar', 'Tolentino', 'Umali', 'Valdez', 'Yap', 'Zamora'];

    private const JUDGES = [
        1 => 'Liza Mendoza',
        2 => 'Arnold Panganiban',
        3 => 'Grace Umali',
        4 => 'Ronald Magpantay',
        5 => 'Sheila Katigbak',
    ];

    public function run(): void
    {
        AuditLog::withoutRecording(function () {
            $password = Hash::make(self::PASSWORD);

            $coaches = [];
            foreach (self::COACHES as $n => [$name, $abbr]) {
                $college = $this->college($abbr);
                $coaches[$n] = $this->account("coach{$n}", [
                    'name' => $name,
                    'role' => 'coach',
                    'password' => $password,
                    'department' => $college->name,     // department_id follows (User::syncDepartmentKey)
                    'sport' => self::SPORTS[0],
                    'sports' => self::SPORTS,           // coach_category follows (User::syncSportKeys)
                    'gender_category' => 'Men & Women',
                    'enrollment_code' => "{$abbr}-TEST{$n}",
                ]);
            }

            foreach ($this->athletePlan() as $n => [$first, $last, $gender, $coachNo, $sport, $jersey]) {
                $coach = $coaches[$coachNo];
                $sr = sprintf('26-%05d', 90000 + $n);   // clearly test SR codes
                $email = "athlete{$n}".self::DOMAIN;

                CampusStudent::updateOrCreate(['sr_code' => $sr], [
                    'first_name' => $first, 'last_name' => $last, 'gender' => $gender,
                    'college' => $coach->department, 'program' => 'BS Test Program',
                    'year_level' => '2nd Year', 'email' => $email,
                ]);

                $user = $this->account("athlete{$n}", [
                    'name' => "{$first} {$last}",
                    'role' => 'athlete',
                    'password' => $password,
                    'sr_code' => $sr,
                    'gender' => $gender,
                    'student_verified_at' => now(),
                    'department' => $coach->department,
                    'year_level' => '2nd Year',
                    'course' => 'BS Test Program',
                    'sport' => $sport,
                    'coach_id' => $coach->id,
                    'coach_name' => $coach->name,
                    'enrolled_at' => now(),
                ]);

                // Their place on the coach's roster, with a jersey number.
                $roster = Athlete::withTrashed()->firstOrNew(['user_id' => $user->id]);
                if (! $roster->exists) {
                    $roster->id = (string) Str::uuid();
                }
                $roster->fill([
                    'student_id' => $sr,
                    'first_name' => $first,
                    'last_name' => $last,
                    'email' => $email,
                    'department' => $coach->department,
                    'year_level' => '2nd Year',
                    'course' => 'BS Test Program',
                    'coach_id' => $coach->id,
                    'sport' => $sport,
                    'category_id' => Category::where('name', $sport)->value('id'),
                    'status' => 'active',
                    'jersey_number' => $jersey,
                    'enrolled_via_code' => true,
                    'enrolled_at' => now(),
                ]);
                $roster->deleted_at = null;
                $roster->save();
            }

            foreach (self::JUDGES as $n => $name) {
                $this->account("judge{$n}", ['name' => $name, 'role' => 'judge', 'password' => $password]);
            }
        });

        $this->command?->info('Test accounts ready — coach1–5, athlete1–'.count($this->athletePlan()).', judge1–5 @g.batstate-u.edu.ph, password: '.self::PASSWORD);
    }

    /**
     * Who plays where: athlete number => [first, last, gender, coach, sport,
     * jersey]. The first ten keep their places; the rest fill every coach's
     * teams up to PER_TEAM in coach order (basketball men, volleyball women).
     */
    private function athletePlan(): array
    {
        $plan = [];
        foreach (self::FIRST_TEN as $n => [$first, $last, $coach, $jersey]) {
            $plan[$n] = [$first, $last, 'Male', $coach, 'Basketball', $jersey];
        }

        $n = count($plan) + 1;
        foreach (array_keys(self::COACHES) as $coach) {
            foreach (self::SPORTS as $sport) {
                $team = array_filter($plan, fn ($p) => $p[3] === $coach && $p[4] === $sport);
                $taken = array_column($team, 5);
                $free = array_values(array_diff(self::JERSEYS[$sport], $taken));
                for ($i = count($team); $i < self::PER_TEAM; $i++, $n++) {
                    $women = $sport === 'Volleyball';
                    $firsts = $women ? self::WOMEN : self::MEN;
                    $plan[$n] = [
                        $firsts[$n % count($firsts)],
                        self::SURNAMES[intdiv($n, 2) % count(self::SURNAMES)],
                        $women ? 'Female' : 'Male',
                        $coach,
                        $sport,
                        $free[$i - count($team)],
                    ];
                }
            }
        }

        return $plan;
    }

    /** Create or update one account by its email's local part. */
    private function account(string $local, array $attrs): User
    {
        $user = User::firstOrNew(['email' => $local.self::DOMAIN]);
        if (! $user->exists) {
            $user->id = (string) Str::uuid();
        }
        $user->fill([
            'active' => true,
            'privacy_notice_accepted_at' => $user->privacy_notice_accepted_at ?? now(),
            'privacy_notice_version' => self::PRIVACY_NOTICE_VERSION,
            ...$attrs,
        ]);
        $user->save();

        return $user;
    }

    private function college(string $abbr): Department
    {
        return Department::where('abbreviation', $abbr)->first()
            ?? throw new \RuntimeException("College {$abbr} doesn't exist — run the ReferenceDataSeeder / add it in Settings first.");
    }
}
