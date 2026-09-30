<?php

namespace App\Console\Commands;

use App\Services\DemoData\DemoDataService;
use App\Services\DemoData\DemoResetException;
use Illuminate\Console\Command;

/**
 * Wipe the site (keeping the admin accounts) and load the demo intramurals.
 * Needs ALLOW_DEMO_RESET=true; takes a backup first. See DemoDataService.
 */
class ResetDemoData extends Command
{
    protected $signature = 'sportaxis:reset-demo {--force : Skip the typed confirmation}';

    protected $description = 'Back up, wipe everything but the admin accounts, and load the demo intramurals';

    public function handle(DemoDataService $demo): int
    {
        if (! DemoDataService::enabled()) {
            $this->error('Demo reset is turned off. Set ALLOW_DEMO_RESET=true in .env to allow it.');

            return self::FAILURE;
        }

        if (! $this->option('force')) {
            $this->warn('This deletes every coach, athlete, judge, game and record on '.config('database.connections.'.config('database.default').'.database').'. Admin accounts are kept; a backup is taken first.');
            if ($this->ask('Type '.DemoDataService::CONFIRMATION.' to continue') !== DemoDataService::CONFIRMATION) {
                $this->info('Cancelled.');

                return self::FAILURE;
            }
        }

        try {
            $result = $demo->reset(null, 'console', $this);
        } catch (DemoResetException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->newLine();
        $this->info("Done in {$result['seconds']}s.");
        $this->line("Backup:      {$result['backup']}");
        $this->line("Credentials: {$result['credentials']} (password demo123)");
        $this->newLine();
        $this->table(['What', 'Count'], collect($result['counts'])->map(fn ($n, $what) => [$what, $n])->values()->all());
        $this->table(['Step', 'Seconds'], collect($result['steps'])->map(fn ($s, $step) => [$step, $s])->values()->all());

        if ($board = $result['report']['leaderboard'] ?? null) {
            $this->line('Overall college race, as the standings show it (ranking rules from Settings → Standings):');
            $this->table(['College', 'Gold', 'Silver', 'Bronze', 'Points'], array_map(fn ($r) => array_values($r), $board));
        }
        if ($champions = $result['report']['champions'] ?? null) {
            $this->table(['Bracket', 'Champion'], collect($champions)->map(fn ($c, $b) => [$b, $c ?? '—'])->values()->all());
        }
        $this->line('Divisions with a champion: '.($result['report']['divisions_crowned'] ?? 0).' of 14.');

        return self::SUCCESS;
    }
}
