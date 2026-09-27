<?php

namespace Database\Seeders\Demo;

use App\Models\User;
use App\Services\DemoData\DemoContext;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * The accounts, all with the password Sportaxis@2026:
 *
 *   coach1–98    one per team. coach1–14 each have their own sport and
 *                division, two per college; the rest follow the same
 *                pattern until every college × division has a coach.
 *   judge1–10    committee members, each with the sports they officiate
 *   athlete1–…   numbered team by team in coach order, on the campus
 *                registry (SR code, program, year level)
 */
class AccountSeeder extends Seeder
{
    private string $hash;

    /** @var array<string, true> */
    private array $usedNames = [];

    public function run(DemoContext $ctx): void
    {
        $this->hash = Hash::make(DemoContext::PASSWORD);
        $ctx->credentials = [];

        $coaches = $this->coaches($ctx);
        $this->judges($ctx);
        $this->athletes($ctx, $coaches);

        $ctx->load();
    }

    /** @return array<int, User> team number => coach */
    private function coaches(DemoContext $ctx): array
    {
        $coaches = [];
        foreach (DemoContext::teams() as $team) {
            $college = $ctx->colleges[$team['college']];
            $female = $team['division'] === 'Women' ? $ctx->faker->boolean(65) : $ctx->faker->boolean(15);
            $name = $this->uniqueName($ctx, $female ? DemoContext::COACH_WOMEN : DemoContext::COACH_MEN);
            $g = $team['division'] === 'Men' ? 'M' : 'W';

            $coach = new User;
            $coach->forceFill([
                'id' => (string) Str::uuid(),
                'email' => $ctx->email('coach', $team['n']),
                'password' => $this->hash,
                'name' => $name,
                'role' => 'coach',
                'active' => true,
                'gender' => $female ? 'Female' : 'Male',
                'department' => $college->name,
                'department_id' => $college->id,
                'sport' => $team['sport'],
                'sports' => [$team['sport']],   // coach_category follows (User::syncSportKeys)
                'gender_category' => $team['division'],
                'phone' => '+639'.$ctx->faker->numerify('#########'),
                'enrollment_code' => "{$team['college']}-".DemoContext::SPORT_CODE[$team['sport']]."-{$g}-2026",
                'privacy_notice_accepted_at' => now()->subDays(40),
                'privacy_notice_version' => DemoContext::PRIVACY_NOTICE_VERSION,
                'created_at' => now()->subDays(40),
            ])->save();
            $coaches[$team['n']] = $coach;
            $this->credential($ctx, $coach->email, 'coach', $name, $team['college'], $team['sport'], $team['division']);
        }

        return $coaches;
    }

    private function judges(DemoContext $ctx): void
    {
        foreach (DemoContext::JUDGE_NAMES as $i => $name) {
            $n = $i + 1;
            $sports = DemoContext::JUDGE_SPORTS[$n];
            (new User)->forceFill([
                'id' => (string) Str::uuid(),
                'email' => $ctx->email('judge', $n),
                'password' => $this->hash,
                'name' => $name,
                'role' => 'judge',
                'active' => true,
                'sport' => $sports[0],
                'sports' => $sports,
                'phone' => '+639'.$ctx->faker->numerify('#########'),
                'privacy_notice_accepted_at' => now()->subDays(40),
                'privacy_notice_version' => DemoContext::PRIVACY_NOTICE_VERSION,
                'created_at' => now()->subDays(40),
            ])->save();
            $this->credential($ctx, $ctx->email('judge', $n), 'judge', $name, null, implode(' / ', $sports), null);
        }
    }

    /**
     * athlete1… team by team, in coach order. Written in batches.
     *
     * @param  array<int, User>  $coaches
     */
    private function athletes(DemoContext $ctx, array $coaches): void
    {
        $users = $registry = [];
        $n = 0;
        $srUsed = [];

        foreach (DemoContext::teams() as $team) {
            $coach = $coaches[$team['n']];
            $female = $team['division'] === 'Women';
            $ls = $team['college'] === 'LS';

            for ($k = 0; $k < DemoContext::ROSTER[$team['sport']]; $k++) {
                $n++;
                [$first, $last] = $this->uniqueStudent($ctx, $female);
                $middle = $ctx->faker->randomElement(DemoContext::SURNAMES);

                // Year level decides the SR code's year: a 1st year entered in 2026 ("26-…").
                if ($ls) {
                    $grade = $ctx->faker->randomElement([11, 12]);
                    $year = "Grade {$grade}";
                    $entered = $grade === 11 ? 26 : 25;
                } else {
                    $level = $ctx->faker->numberBetween(1, 4);
                    $year = $level.['st', 'nd', 'rd', 'th'][$level - 1].' Year';
                    $entered = 27 - $level;
                }
                do {
                    $sr = sprintf('%02d-%05d', $entered, $ctx->faker->numberBetween(10000, 99999));
                } while (isset($srUsed[$sr]));
                $srUsed[$sr] = true;

                $id = (string) Str::uuid();
                $email = $ctx->email('athlete', $n);
                $course = $ctx->faker->randomElement(DemoContext::PROGRAMS[$team['college']]);
                $joined = now()->subDays($ctx->faker->numberBetween(25, 38))->setTime(9, 0)->addMinutes($n);
                $parent = $ctx->faker->randomElement([...DemoContext::COACH_WOMEN, ...DemoContext::COACH_MEN]).' '.$last;
                $contact = json_encode(['name' => $parent, 'relationship' => 'Parent', 'phone' => '+639'.$ctx->faker->numerify('#########')]);
                $name = "{$first} {$last}";

                $users[] = [
                    'id' => $id, 'email' => $email, 'password' => $this->hash, 'name' => $name,
                    'role' => 'athlete', 'active' => true, 'sr_code' => $sr, 'gender' => $female ? 'Female' : 'Male',
                    'student_verified_at' => $joined, 'department' => $coach->department, 'department_id' => $coach->department_id,
                    'year_level' => $year, 'course' => $course, 'phone' => '+639'.$ctx->faker->numerify('#########'),
                    'emergency_contact' => $contact, 'sport' => $team['sport'], 'sports' => json_encode([$team['sport']]),
                    'gender_category' => null, 'enrollment_code' => null,
                    'coach_id' => $coach->id, 'coach_name' => $coach->name, 'enrolled_at' => $joined,
                    'privacy_notice_accepted_at' => $joined, 'privacy_notice_version' => DemoContext::PRIVACY_NOTICE_VERSION,
                    'created_at' => $joined, 'updated_at' => $joined,
                ];
                $registry[] = [
                    'sr_code' => $sr, 'first_name' => $first, 'last_name' => $last, 'middle_name' => $middle,
                    'gender' => $female ? 'Female' : 'Male', 'college' => $coach->department, 'program' => $course,
                    'year_level' => $year, 'email' => $email, 'created_at' => now(), 'updated_at' => now(),
                ];
                $this->credential($ctx, $email, 'athlete', $name, $team['college'], $team['sport'], $team['division']);
            }
        }

        foreach (['users' => $users, 'campus_students' => $registry] as $table => $rows) {
            foreach (array_chunk($rows, 250) as $chunk) {
                DB::table($table)->insert($chunk);
            }
        }
    }

    /** A given name + surname no one else in the demo has. */
    private function uniqueName(DemoContext $ctx, array $firsts): string
    {
        do {
            $name = $ctx->faker->randomElement($firsts).' '.$ctx->faker->randomElement(DemoContext::SURNAMES);
        } while (isset($this->usedNames[$name]));
        $this->usedNames[$name] = true;

        return $name;
    }

    /** @return array{0: string, 1: string} */
    private function uniqueStudent(DemoContext $ctx, bool $female): array
    {
        [$first, $last] = explode(' ', $this->uniqueNameParts($ctx, $female ? DemoContext::WOMEN : DemoContext::MEN), 2);

        return [str_replace('_', ' ', $first), $last];
    }

    /** "John_Paul Dela Cruz" — the given name's spaces kept apart from the surname's. */
    private function uniqueNameParts(DemoContext $ctx, array $firsts): string
    {
        do {
            $first = str_replace(' ', '_', $ctx->faker->randomElement($firsts));
            $name = $first.' '.$ctx->faker->randomElement(DemoContext::SURNAMES);
        } while (isset($this->usedNames[$name]));
        $this->usedNames[$name] = true;

        return $name;
    }

    private function credential(DemoContext $ctx, string $email, string $role, string $name, ?string $college, ?string $sport, ?string $division): void
    {
        $ctx->credentials[] = [
            'role' => $role, 'email' => $email, 'password' => DemoContext::PASSWORD, 'name' => $name,
            'college' => $college ?? '', 'sport' => $sport ?? '', 'division' => $division ?? '',
        ];
    }
}
