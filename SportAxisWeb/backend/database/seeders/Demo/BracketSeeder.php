<?php

namespace Database\Seeders\Demo;

use App\Services\DemoData\DemoContext;
use App\Services\DemoData\DemoScheduler;
use Illuminate\Database\Seeder;

/**
 * The main event's brackets, through the real BracketService — seeded by
 * last year's final ranking, published with its venue conflict check, a
 * judge and both lineups on every game. Days are relative to today:
 *
 *   Single elimination (7 colleges, the top seed gets a bye):
 *     Basketball, Beach Volleyball, Sepak Takraw — Men's and Women's
 *   Round robin (21 games each):
 *     Volleyball, Chess — Men's and Women's
 *     Badminton, Table Tennis — every line, Men's and Women's
 *   Men's Volleyball's group stage is followed by top-4 playoffs
 *   (ResultSeeder draws them once the group stage is played).
 */
class BracketSeeder extends Seeder
{
    /** [division, venue, day of each round, start, minutes]. */
    private const ELIMINATION = [
        ['Beach Volleyball — Men', 'Beach Volleyball Sand Court', [-12, -11, -9], '08:00', 60],
        ['Basketball — Women', 'University Gymnasium', [-11, -6, -4], '08:00', 90],
        ['Basketball — Men', 'University Gymnasium', [-9, -2, 0], '08:00', 90],
        ['Sepak Takraw — Men', 'Multi-Purpose Hall', [-7, -5, -3], '08:00', 60],
        ['Sepak Takraw — Women', 'Multi-Purpose Hall', [-1, 0, 5], '08:00', 60],
        ['Beach Volleyball — Women', 'Beach Volleyball Sand Court', [-2, 1, 6], '08:00', 60],
    ];

    /** [division or line, venue, first day, start, minutes] — the generator rolls to the next day at 6 PM. */
    private const ROUND_ROBIN = [
        ['Volleyball — Men', 'Covered Court A', -12, '08:00', 60],
        ['Volleyball — Women', 'Covered Court B', -8, '08:00', 60],
        ['Chess — Men', 'Chess Room (Library Function Hall)', -12, '08:00', 90],
        ['Chess — Women', 'Chess Room (Library Function Hall)', -1, '08:00', 90],
        ['Badminton — M Singles A', 'Badminton Hall — Court 1', -12, '08:00', 45],
        ['Badminton — M Singles B', 'Badminton Hall — Court 2', -12, '08:00', 45],
        ['Badminton — M Doubles', 'Badminton Hall — Court 3', -12, '08:00', 45],
        ['Badminton — W Singles A', 'Badminton Hall — Court 1', 0, '08:00', 45],
        ['Badminton — W Singles B', 'Badminton Hall — Court 2', 0, '08:00', 45],
        ['Badminton — W Doubles', 'Badminton Hall — Court 3', 0, '08:00', 45],
        ['Table Tennis — M Singles A', 'Table Tennis Room — Table 1', -6, '08:00', 45],
        ['Table Tennis — M Singles B', 'Table Tennis Room — Table 2', -6, '08:00', 45],
        ['Table Tennis — M Doubles', 'Table Tennis Room — Table 3', -6, '08:00', 45],
        ['Table Tennis — W Singles A', 'Table Tennis Room — Table 1', 1, '08:00', 45],
        ['Table Tennis — W Singles B', 'Table Tennis Room — Table 2', 1, '08:00', 45],
        ['Table Tennis — W Doubles', 'Table Tennis Room — Table 3', 1, '08:00', 45],
    ];

    public function run(DemoContext $ctx): void
    {
        $sched = new DemoScheduler($ctx);
        $seeds = fn (string $category) => array_map(fn ($abbr) => DemoContext::COLLEGES[$abbr], DemoContext::previousRanking($category));

        foreach (self::ELIMINATION as [$category, $venue, $days, $time, $minutes]) {
            $sched->bracket($category, 'single_elimination', $seeds($category), $venue, $days, $time, $minutes);
        }
        foreach (self::ROUND_ROBIN as [$category, $venue, $day, $time, $minutes]) {
            $name = null;
            if (str_contains($category, 'Singles') || str_contains($category, 'Doubles')) {
                [$sport, $line] = explode(' — ', $category);
                $name = "{$sport} ".(str_starts_with($line, 'W') ? "Women's" : "Men's").' '.substr($line, 2).' — Round Robin';
            } elseif ($category === 'Volleyball — Men') {
                $name = "Men's Volleyball — Group Stage";
            }
            $sched->bracket($category, 'round_robin', $seeds($category), $venue, [$day], $time, $minutes, name: $name);
        }
    }
}
