<?php

namespace Database\Seeders\Demo;

use App\Services\DemoData\DemoContext;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Every team's roster — the coach's athletes, in lineup order (starters
 * first) with jersey numbers unique within the team — and the racquet
 * lines each Badminton and Table Tennis coach enters: Singles A, Singles B
 * and a Doubles pair.
 *
 *   Basketball 12 (5 starters)       Volleyball 12 (rotation I–VI + bench)
 *   Beach Volleyball 3 (pair + 1)    Sepak Takraw 5 (Tekong, Feeder, Striker + 2)
 *   Badminton, Table Tennis 4        Chess 5 (Boards 1–4 + reserve)
 *
 * Game lineups are set per game, when the games are scheduled.
 */
class TeamLineupSeeder extends Seeder
{
    /** Starters per sport; only reserves get hurt. */
    private const STARTERS = ['Basketball' => 5, 'Volleyball' => 6, 'Beach Volleyball' => 2, 'Sepak Takraw' => 3, 'Badminton' => 4, 'Table Tennis' => 4, 'Chess' => 4];

    public function run(DemoContext $ctx): void
    {
        $students = DB::table('campus_students')->get()->keyBy('sr_code');
        $athletes = DB::table('users')->where('role', 'athlete')->get()
            ->sortBy(fn ($u) => DemoContext::number($u->email))->groupBy('coach_id');
        $rows = [];

        foreach (DemoContext::teams() as $team) {
            $coach = $ctx->coach($team['college'], $team['sport'], $team['division']);
            $players = $athletes[$coach->id] ?? collect();
            $jerseys = $this->jerseys($ctx, $team['sport'], $players->count());

            foreach ($players->values() as $k => $u) {
                $s = $students[$u->sr_code];
                $injured = $k >= self::STARTERS[$team['sport']] && $ctx->faker->boolean(4);
                $rows[] = [
                    'id' => $u->id, 'user_id' => $u->id, 'student_id' => $u->sr_code,
                    'first_name' => $s->first_name, 'last_name' => $s->last_name, 'email' => $u->email,
                    'department' => $u->department, 'year_level' => $u->year_level, 'course' => $u->course,
                    'coach_id' => $coach->id, 'sport' => $team['sport'], 'category_id' => $ctx->categoryIds[$team['sport']] ?? null,
                    'status' => $injured ? 'injured' : 'active', 'jersey_number' => (string) $jerseys[$k],
                    'emergency_contact' => $u->emergency_contact, 'enrolled_via_code' => true, 'enrolled_at' => $u->enrolled_at,
                    'created_at' => $u->created_at, 'updated_at' => $u->created_at,
                ];
            }
        }
        foreach (array_chunk($rows, 250) as $chunk) {
            DB::table('athletes')->insert($chunk);
        }

        $ctx->load();
        $this->racquetLines($ctx);
    }

    /** Distinct jersey numbers for a team, in lineup order. */
    private function jerseys(DemoContext $ctx, string $sport, int $count): array
    {
        return match ($sport) {
            'Basketball' => $ctx->faker->randomElements([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 20, 21, 22, 23, 24, 25, 30, 32, 33, 35], $count),
            'Volleyball' => $ctx->faker->randomElements(range(1, 20), $count),
            'Sepak Takraw', 'Beach Volleyball' => $ctx->faker->randomElements(range(1, 12), $count),
            default => range(1, $count),   // chess boards, racquet line order
        };
    }

    /** Singles A = the team's #1, Singles B = #2, Doubles = #3 and #4. */
    private function racquetLines(DemoContext $ctx): void
    {
        $rows = [];
        foreach (DemoContext::teams() as $team) {
            if (! in_array($team['sport'], DemoContext::RACQUET_SPORTS, true)) {
                continue;
            }
            $coach = $ctx->coach($team['college'], $team['sport'], $team['division']);
            $players = $ctx->roster($coach);
            $g = $team['division'] === 'Men' ? 'M' : 'W';
            foreach ([['Singles A', null], ['Singles B', null], ['Doubles', 'C'], ['Doubles', 'D']] as $k => [$line, $slot]) {
                if ($a = $players[$k] ?? null) {
                    $rows[] = [
                        'id' => (string) Str::uuid(), 'category' => "{$team['sport']} — {$g} {$line}", 'department' => $coach->department,
                        'athlete_id' => $a->id, 'athlete_name' => "{$a->first_name} {$a->last_name}",
                        'coach_id' => $coach->id, 'pair_slot' => $slot,
                        'created_at' => now()->subDays(20), 'updated_at' => now()->subDays(20),
                    ];
                }
            }
        }
        DB::table('discipline_entries')->insert($rows);
    }
}
