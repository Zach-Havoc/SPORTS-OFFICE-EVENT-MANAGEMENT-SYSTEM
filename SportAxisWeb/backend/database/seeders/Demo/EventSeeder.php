<?php

namespace Database\Seeders\Demo;

use App\Services\DemoData\DemoContext;
use App\Services\DemoData\DemoScheduler;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The events and where they happen:
 *   - the main event, "BatStateU Intramurals 2026" — the active season,
 *     about three weeks around today (its brackets: BracketSeeder); last
 *     year's edition stays on record as an inactive season
 *   - the venues, the eligibility checklist and the registration codes
 *   - four smaller events, as games outside the brackets:
 *       Pre-Season Beach Volleyball Invitational   three weeks ago, played
 *       Inter-College Friendly Series              last week played, next week to come
 *       Founders' Week Table Tennis Exhibition     in a few days
 *       BatStateU Chess Open 2026                  after the chess leagues
 */
class EventSeeder extends Seeder
{
    /** [event, category, home, away, venue, day, time, minutes]. */
    private const SIDE_GAMES = [
        ['Pre-Season Beach Volleyball Invitational', 'Beach Volleyball — Men', 'CICS', 'CAS', 'Beach Volleyball Sand Court', -20, '09:00', 60],
        ['Pre-Season Beach Volleyball Invitational', 'Beach Volleyball — Men', 'CCJE', 'CONAHS', 'Beach Volleyball Sand Court', -20, '10:15', 60],
        ['Pre-Season Beach Volleyball Invitational', 'Beach Volleyball — Women', 'CTE', 'CABEIHM', 'Beach Volleyball Sand Court', -19, '09:00', 60],
        ['Pre-Season Beach Volleyball Invitational', 'Beach Volleyball — Women', 'LS', 'CAS', 'Beach Volleyball Sand Court', -19, '10:15', 60],
        ['Inter-College Friendly Series', 'Basketball — Women', 'CAS', 'LS', 'Covered Court B', -5, '09:00', 90],
        ['Inter-College Friendly Series', 'Sepak Takraw — Men', 'CICS', 'CTE', 'Covered Court B', -5, '14:00', 60],
        ['Inter-College Friendly Series', 'Basketball — Men', 'CCJE', 'CONAHS', 'Covered Court B', -4, '16:00', 90],
        ['Inter-College Friendly Series', 'Basketball — Men', 'CABEIHM', 'CCJE', 'Covered Court B', 4, '16:00', 90],
        ['Inter-College Friendly Series', 'Basketball — Women', 'CABEIHM', 'CTE', 'Covered Court B', 5, '09:00', 90],
        ['Inter-College Friendly Series', 'Sepak Takraw — Women', 'CONAHS', 'CAS', 'Covered Court B', 5, '14:00', 60],
        ["Founders' Week Table Tennis Exhibition", 'Table Tennis — M Singles A', 'CICS', 'CABEIHM', 'Table Tennis Room — Table 4', 3, '15:00', 45],
        ["Founders' Week Table Tennis Exhibition", 'Table Tennis — W Singles A', 'CONAHS', 'CTE', 'Table Tennis Room — Table 4', 3, '16:00', 45],
        ['BatStateU Chess Open 2026', 'Chess — Men', 'CICS', 'CAS', 'Chess Room (Library Function Hall)', 7, '08:00', 90],
        ['BatStateU Chess Open 2026', 'Chess — Men', 'CTE', 'LS', 'Chess Room (Library Function Hall)', 7, '09:45', 90],
        ['BatStateU Chess Open 2026', 'Chess — Women', 'CABEIHM', 'CCJE', 'Chess Room (Library Function Hall)', 8, '08:00', 90],
        ['BatStateU Chess Open 2026', 'Chess — Women', 'CONAHS', 'CICS', 'Chess Room (Library Function Hall)', 8, '09:45', 90],
    ];

    public function run(DemoContext $ctx): void
    {
        $this->seasons($ctx);
        $this->reference($ctx);
        $this->venues($ctx);
        $ctx->load();

        $sched = new DemoScheduler($ctx);
        foreach (self::SIDE_GAMES as [$event, $category, $home, $away, $venue, $day, $time, $minutes]) {
            [$sport, $division] = DemoContext::parse($category);
            $line = str_contains($category, 'Singles') || str_contains($category, 'Doubles') ? ' '.explode(' — ', $category)[1] : '';
            $sched->game($category, "{$event} — {$division}'s {$sport}{$line}: {$home} vs {$away}", $home, $away, $venue, $day, $time, $minutes);
        }
    }

    private function seasons(DemoContext $ctx): void
    {
        foreach ([
            [DemoContext::PREVIOUS_SEASON, $ctx->today->copy()->subYear()->subDays(12), $ctx->today->copy()->subYear()->addDays(9), false],
            [DemoContext::SEASON, $ctx->today->copy()->subDays(21), $ctx->today->copy()->addDays(9), true],
        ] as [$name, $from, $to, $active]) {
            DB::table('seasons')->insert([
                'id' => (string) Str::uuid(), 'name' => $name, 'starts_on' => $from->toDateString(), 'ends_on' => $to->toDateString(),
                'is_active' => $active, 'created_at' => now()->subDays(45), 'updated_at' => now()->subDays(45),
            ]);
        }
    }

    private function reference(DemoContext $ctx): void
    {
        (new ReferenceDataSeeder)->seedDefaultRequirementTypes();

        foreach ([
            ['ADMIN-2026', 'admin', 'Sports Office staff'],
            ['COACH-2026', 'coach', 'Coaches, '.DemoContext::SEASON],
            ['JUDGE-2026', 'judge', 'Committee members, '.DemoContext::SEASON],
            ['ATHLETE-2026', 'athlete', 'Athletes, '.DemoContext::SEASON],
        ] as [$code, $role, $label]) {
            DB::table('registration_codes')->insert([
                'code' => $code, 'role' => $role, 'label' => $label, 'used' => false,
                'created_by' => $ctx->adminId, 'expires_at' => now()->addMonths(3),
                'created_at' => now()->subDays(45), 'updated_at' => now()->subDays(45),
            ]);
        }
    }

    private function venues(DemoContext $ctx): void
    {
        $rows = [];
        foreach (DemoContext::VENUES as $name => [$type, $capacity, $sports, $location, $facilities]) {
            $rows[] = [
                'id' => (string) Str::uuid(), 'name' => $name, 'type' => $type, 'capacity' => $capacity,
                'sports' => json_encode($sports), 'location' => $location, 'facilities' => $facilities,
                'status' => 'available', 'created_by' => $ctx->adminId, 'created_at' => now()->subDays(45), 'updated_at' => now()->subDays(45),
            ];
        }
        DB::table('venues')->insert($rows);
    }
}
