<?php

namespace Database\Seeders;

use App\Models\AuditLog;
use App\Models\Bracket;
use App\Models\Category;
use App\Models\Department;
use App\Services\BracketService;
use Illuminate\Database\Seeder;

/**
 * A sample double-elimination bracket, without touching anything else:
 * up to 8 of the existing colleges, seeded in name order, starting next
 * Monday at 08:00, venue to be decided. It's left as a DRAFT — open it under
 * Bracketing, check it, and "Publish & create events" puts its games on the
 * calendar (the grand-final reset joins them only if it's needed).
 *
 *   php artisan db:seed --class=DoubleEliminationSeeder
 *
 * Safe to run again: it won't add a second sample while one exists.
 * (The full demo — Settings → System → Reset & Load Demo Data — already has
 * a played-out double elimination: Men's Sepak Takraw.)
 */
class DoubleEliminationSeeder extends Seeder
{
    private const NAME = 'Double Elimination (Sample)';

    /** The first of these that exists as a versus sport is used. */
    private const SPORTS = ['Basketball — Men', 'Basketball', 'Volleyball — Men', 'Volleyball', 'Sepak Takraw — Men', 'Sepak Takraw'];

    public function run(BracketService $brackets): void
    {
        $colleges = Department::orderBy('name')->limit(8)->pluck('name')->all();
        if (count($colleges) < 3) {
            $this->command?->warn('Double elimination needs at least 3 colleges — add colleges first (Settings → Colleges).');

            return;
        }
        if (Bracket::where('name', self::NAME)->exists()) {
            $this->command?->info('The sample double-elimination bracket is already there — nothing to do.');

            return;
        }

        $sport = collect(self::SPORTS)->first(
            fn ($name) => Category::where('name', $name)->where(fn ($q) => $q->whereNull('format')->orWhere('format', 'versus'))->exists(),
        ) ?? 'Basketball';

        $bracket = AuditLog::withoutRecording(function () use ($brackets, $sport, $colleges) {
            $bracket = $brackets->generate([
                'sport' => $sport,
                'format' => 'double_elimination',
                'participants' => $colleges,
                'drawMethod' => 'manual',
                'startDate' => now()->next('Monday')->toDateString(),
                'startTime' => '08:00',
                'matchDuration' => 60,
                'breakDuration' => 15,
                'grandFinalReset' => true,
            ]);
            $bracket->update(['name' => self::NAME]);

            return $bracket;
        });

        $games = $bracket->matches->where('is_bye', false)->count();
        $this->command?->info("Created \"{$bracket->name}\" ({$sport}) — ".count($colleges)." colleges, {$games} games incl. the possible reset. It's a draft: publish it from Bracketing.");
    }
}
