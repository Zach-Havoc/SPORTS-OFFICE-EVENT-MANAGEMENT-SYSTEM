<?php

namespace Database\Seeders;

use App\Services\DemoData\DemoDataService;
use App\Services\DemoData\DemoResetException;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * DESTRUCTIVE. The demo intramurals, built around today — the same reset as
 * Settings → System → "Reset & Load Demo Data" and `sportaxis:reset-demo`:
 * backup first, everything but the admin accounts and colleges wiped, then
 * today's live games, results, rosters and upcoming fixtures. Every demo
 * account's password is demo123.
 *
 * Still needs ALLOW_DEMO_RESET=true, so the maintenance token alone can never
 * wipe a live season. On the deployed site:
 *
 *   /artisan-migrate?token=<MIGRATION_TOKEN>&seed=1&class=DemoDataSeeder
 */
class DemoDataSeeder extends Seeder
{
    public function run(DemoDataService $demo): void
    {
        try {
            $result = $demo->reset(null, 'web');
        } catch (DemoResetException $e) {
            // Fails the maintenance page (500) with the reason, instead of a
            // quiet "seeded" when nothing happened.
            throw new RuntimeException($e->getMessage(), previous: $e);
        }

        $this->command?->info("Demo loaded in {$result['seconds']}s — every demo account's password is demo123.");
        foreach ($result['counts'] as $what => $n) {
            $this->command?->line("  {$what}: {$n}");
        }
    }
}
