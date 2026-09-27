<?php

namespace App\Services\DemoData;

use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\Demo\AccountSeeder;
use Database\Seeders\Demo\BracketSeeder;
use Database\Seeders\Demo\CollegeSeeder;
use Database\Seeders\Demo\EventSeeder;
use Database\Seeders\Demo\MiscSeeder;
use Database\Seeders\Demo\RankingSeeder;
use Database\Seeders\Demo\ResultSeeder;
use Database\Seeders\Demo\SportSeeder;
use Database\Seeders\Demo\TeamLineupSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

/**
 * DESTRUCTIVE. Replaces everything on the site with the demo intramurals —
 * `php artisan sportaxis:reset-demo` and the admin's "Reset & Load Demo
 * Data" button both come here.
 *
 *   1. refuses unless ALLOW_DEMO_RESET=true, and while another reset runs
 *   2. dumps the database to storage/app/backups/pre-reset-{timestamp}.sql,
 *      and stops if that fails
 *   3. wipes every table except the admin accounts (and their sign-ins),
 *      `migrations`, and the office's own configuration — the eligibility
 *      checklist, the homepage slides and the office settings (such as how
 *      the standings are ranked). College rows are pruned, not
 *      wiped, so their logos survive.
 *   4. seeds, in one transaction: colleges, sports, accounts, rosters,
 *      events, brackets, results, rankings, everything else
 *   5. writes the logins to storage/app/demo-credentials.csv and records
 *      who reset the site in the audit trail and the log
 */
class DemoDataService
{
    public const CONFIRMATION = 'RESET SPORTAXIS';

    /** Kept whole. `users`, `personal_access_tokens` and `departments` are pruned instead. */
    private const KEEP = ['migrations', 'users', 'personal_access_tokens', 'departments', 'requirement_types', 'site_slides', 'app_settings'];

    /** In the order they run. */
    public const SEEDERS = [
        CollegeSeeder::class, SportSeeder::class, AccountSeeder::class, TeamLineupSeeder::class,
        EventSeeder::class, BracketSeeder::class, ResultSeeder::class, RankingSeeder::class, MiscSeeder::class,
    ];

    public function __construct(private DatabaseBackup $backup) {}

    public static function enabled(): bool
    {
        return (bool) config('sportaxis.allow_demo_reset');
    }

    /**
     * @return array{backup: string, credentials: string, seconds: float, steps: array<string, float>, counts: array<string, int>, report: array, triggered_by: ?string}
     */
    public function reset(?User $by, string $via, ?Command $command = null): array
    {
        if (! self::enabled()) {
            throw new DemoResetException('Demo reset is turned off. Set ALLOW_DEMO_RESET=true in .env to allow it.');
        }
        if (! DB::table('users')->where('role', 'admin')->exists()) {
            throw new DemoResetException('No admin account found — refusing to reset, it would lock everyone out.');
        }

        File::ensureDirectoryExists(storage_path('app'));
        $lock = fopen(storage_path('app/demo-reset.lock'), 'c');
        if (! $lock || ! flock($lock, LOCK_EX | LOCK_NB)) {
            throw new DemoResetException('A demo reset is already running.');
        }

        try {
            @set_time_limit(0);
            ini_set('memory_limit', '1024M');
            $started = microtime(true);
            $steps = [];
            $time = function (string $step, callable $fn) use (&$steps, $command) {
                $command?->line("  {$step}…");
                $t = microtime(true);
                $result = $fn();
                $steps[$step] = round(microtime(true) - $t, 2);

                return $result;
            };

            $backup = $time('Backup', fn () => $this->backup->dump(storage_path('app/backups/pre-reset-'.now()->format('Y-m-d_His').'.sql')));
            $who = $by ? "{$by->name} <{$by->email}>" : 'the console';
            Log::warning("Demo reset started by {$who} via {$via}. Backup: {$backup}");

            $ctx = new DemoContext;
            AuditLog::withoutRecording(function () use ($time, $ctx, $command) {
                $time('Wipe', fn () => $this->wipe());
                Cache::flush();
                $ctx->load();
                DB::transaction(function () use ($time, $ctx, $command) {
                    foreach (self::SEEDERS as $class) {
                        $time(class_basename($class), function () use ($class, $ctx, $command) {
                            $seeder = app($class)->setContainer(app());
                            if ($command) {
                                $seeder->setCommand($command);
                            }
                            $seeder->__invoke(['ctx' => $ctx]);
                        });
                    }
                });
            });
            Cache::flush();

            $credentials = $this->writeCredentials($ctx);
            $this->record($by, $via, $backup);
            Log::warning("Demo reset finished for {$who} in ".round(microtime(true) - $started, 1).'s.');

            return [
                'backup' => $backup,
                'credentials' => $credentials,
                'seconds' => round(microtime(true) - $started, 1),
                'steps' => $steps,
                'counts' => self::counts(),
                'report' => $ctx->report,
                'triggered_by' => $by?->email,
            ];
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    /** Every table empty but the admins, their sign-ins, the colleges' rows and the office's configuration. */
    private function wipe(): void
    {
        $admins = DB::table('users')->where('role', 'admin')->pluck('id')->all();
        // This database's tables only — unscoped, MySQL lists every database on the server.
        $schema = match (DB::getDriverName()) {
            'pgsql' => 'public',
            'sqlite' => 'main',
            default => DB::getDatabaseName(),
        };
        $tables = Schema::getTableListing($schema, schemaQualified: false);

        Schema::disableForeignKeyConstraints();
        try {
            foreach ($tables as $table) {
                if (! in_array($table, self::KEEP, true)) {
                    DB::table($table)->truncate();
                }
            }
            DB::table('users')->whereNotIn('id', $admins)->delete();
            DB::table('users')->whereIn('id', $admins)->update(['coach_id' => null, 'coach_name' => null]);
            DB::table('personal_access_tokens')->where(fn ($q) => $q
                ->where('tokenable_type', '!=', User::class)
                ->orWhereNotIn('tokenable_id', $admins))->delete();
        } finally {
            Schema::enableForeignKeyConstraints();
        }

        // Files the wiped rows pointed at (requirement uploads).
        Storage::disk('public')->deleteDirectory('requirements');
    }

    private function writeCredentials(DemoContext $ctx): string
    {
        $path = storage_path('app/demo-credentials.csv');
        $out = fopen($path, 'w');
        fputcsv($out, ['role', 'email', 'password', 'name', 'college', 'sport', 'division'], escape: '');
        foreach ($ctx->credentials as $row) {
            fputcsv($out, array_values($row), escape: '');
        }
        fclose($out);

        return $path;
    }

    /** The reset itself goes in the (fresh) audit trail. */
    private function record(?User $by, string $via, string $backup): void
    {
        DB::table('audit_logs')->insert([
            'user_id' => $by?->id, 'user_name' => $by?->name ?? 'Console', 'user_role' => $by?->role ?? 'system',
            'event' => 'demo_reset', 'auditable_type' => 'System', 'auditable_id' => 'demo-data',
            'old_values' => null, 'new_values' => json_encode(['via' => $via, 'backup' => basename($backup)]),
            'ip_address' => request()?->ip(), 'user_agent' => substr((string) request()?->userAgent(), 0, 512) ?: null,
            'url' => $via === 'web' ? request()?->path() : 'artisan sportaxis:reset-demo', 'created_at' => now(),
        ]);
    }

    /** @return array<string, int> */
    public static function counts(): array
    {
        $users = fn (string $role) => DB::table('users')->where('role', $role)->count();
        $events = fn (string $status) => DB::table('events')->where('status', $status)->whereNull('deleted_at')->count();

        return [
            'colleges' => DB::table('departments')->count(),
            'sports' => DB::table('categories')->whereNull('parent_id')->count(),
            'divisions' => count(DemoContext::SPORTS) * 2,
            'racquet lines' => DB::table('categories')->whereIn('parent_sport', DemoContext::RACQUET_SPORTS)->count(),
            'teams' => $users('coach'),
            'admins' => $users('admin'),
            'coaches' => $users('coach'),
            'judges' => $users('judge'),
            'athletes' => $users('athlete'),
            'venues' => DB::table('venues')->count(),
            'seasons' => DB::table('seasons')->count(),
            'brackets' => DB::table('brackets')->count(),
            'brackets completed' => DB::table('brackets')->where('status', 'completed')->count(),
            'games' => DB::table('events')->whereNull('deleted_at')->count(),
            'games completed' => $events('completed'),
            'games live' => $events('ongoing'),
            'games scheduled' => $events('upcoming'),
            'results' => DB::table('team_matches')->count(),
            'lineup entries' => DB::table('game_players')->count(),
            'racquet line entries' => DB::table('discipline_entries')->count(),
            'play-by-play plays' => DB::table('game_events')->count(),
            'performance notes' => DB::table('performance_records')->count(),
            'announcements' => DB::table('announcements')->count(),
            'tryout applications' => DB::table('tryout_applications')->count(),
            'attendance records' => DB::table('attendance_records')->count(),
            'requirements' => DB::table('requirements')->count(),
            'appeals' => DB::table('protests')->count(),
            'notifications' => DB::table('notifications')->count(),
            'audit log entries' => DB::table('audit_logs')->count(),
            'venue double-bookings' => self::overlaps(fn ($e) => $e->venue_id),
            'judge double-bookings' => self::overlaps(fn ($e) => json_decode((string) $e->judges, true)[0]['id'] ?? null),
        ];
    }

    /** Pairs of games on the same day and at overlapping times that share a venue (or a judge). */
    private static function overlaps(callable $key): int
    {
        $minutes = fn (?string $t) => $t ? (int) substr($t, 0, 2) * 60 + (int) substr($t, 3, 2) : null;
        $clashes = 0;
        $games = DB::table('events')->whereNull('deleted_at')->get(['id', 'schedule', 'start_time', 'end_time', 'venue_id', 'judges']);
        foreach ($games->groupBy(fn ($e) => substr((string) $e->schedule, 0, 10).'|'.$key($e)) as $group => $sameDay) {
            if (str_ends_with($group, '|')) {
                continue;
            }
            $sorted = $sameDay->sortBy(fn ($e) => $minutes($e->start_time))->values();
            for ($i = 1; $i < $sorted->count(); $i++) {
                if ($minutes($sorted[$i]->start_time) < $minutes($sorted[$i - 1]->end_time)) {
                    $clashes++;
                }
            }
        }

        return $clashes;
    }
}
