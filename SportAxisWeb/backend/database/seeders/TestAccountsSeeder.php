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
 *   coach1–5@g.batstate-u.edu.ph     coach1 CICS Basketball, coach2 CABEIHM Basketball,
 *                                    coach3 CICS Volleyball, coach4 CABEIHM Volleyball,
 *                                    coach5 CAS Basketball
 *   athlete1–10@g.batstate-u.edu.ph  1–5 on coach1's CICS Basketball team,
 *                                    6–10 on coach2's CABEIHM Basketball team,
 *                                    each with a jersey number
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

    /** [college abbreviation, sport] per coach. */
    private const COACHES = [
        1 => ['Marco Villanueva', 'CICS', 'Basketball'],
        2 => ['Joanna Castillo', 'CABEIHM', 'Basketball'],
        3 => ['Rafael Dimaculangan', 'CICS', 'Volleyball'],
        4 => ['Carla Macaraig', 'CABEIHM', 'Volleyball'],
        5 => ['Dennis Ramirez', 'CAS', 'Basketball'],
    ];

    /** [first, last, gender, coach number, jersey]. */
    private const ATHLETES = [
        1 => ['Paolo', 'Reyes', 'Male', 1, '4'],
        2 => ['Miguel', 'Santos', 'Male', 1, '7'],
        3 => ['Josh', 'Cruz', 'Male', 1, '10'],
        4 => ['Kenneth', 'Dela Paz', 'Male', 1, '12'],
        5 => ['Adrian', 'Garcia', 'Male', 1, '15'],
        6 => ['Nico', 'Aquino', 'Male', 2, '3'],
        7 => ['Rey', 'Ramos', 'Male', 2, '5'],
        8 => ['Carlo', 'Torres', 'Male', 2, '8'],
        9 => ['Luis', 'Villa', 'Male', 2, '11'],
        10 => ['Enzo', 'Castro', 'Male', 2, '14'],
    ];

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
            foreach (self::COACHES as $n => [$name, $abbr, $sport]) {
                $college = $this->college($abbr);
                $coaches[$n] = $this->account("coach{$n}", [
                    'name' => $name,
                    'role' => 'coach',
                    'password' => $password,
                    'department' => $college->name,     // department_id follows (User::syncDepartmentKey)
                    'sport' => $sport,
                    'sports' => [$sport],               // coach_category follows (User::syncSportKeys)
                    'gender_category' => 'Men',
                    'enrollment_code' => "{$abbr}-".strtoupper(Str::substr($sport, 0, 4))."-T{$n}",
                ]);
            }

            foreach (self::ATHLETES as $n => [$first, $last, $gender, $coachNo, $jersey]) {
                $coach = $coaches[$coachNo];
                $sport = self::COACHES[$coachNo][2];
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

        $this->command?->info('Test accounts ready — coach1–5, athlete1–10, judge1–5 @g.batstate-u.edu.ph, password: '.self::PASSWORD);
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
