<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;
use Throwable;

/**
 * A dependency-free MySQL backup: `mysqldump` piped through gzip to a
 * timestamped file in `storage/app/backups/`, with old files pruned.
 * Scheduled daily in routes/console.php.
 *
 * When the `s3` disk is configured (AWS_BUCKET and friends filled in), the
 * same file is also pushed offsite to `backups/` on that disk. If it isn't
 * configured, or the upload fails, the command still succeeds — the local
 * copy is the primary guarantee, offsite is best-effort on top of it.
 *
 * See docs/BACKUP.md for restore steps.
 */
class BackupDatabase extends Command
{
    protected $signature = 'backup:database {--keep=14 : Days of backups to retain}';

    protected $description = 'Dump the MySQL database to storage/app/backups and prune old files';

    public function handle(): int
    {
        $conn = config('database.default');

        if ($conn !== 'mysql') {
            $this->warn("backup:database supports the mysql driver only (current: {$conn}). Skipped.");

            return self::SUCCESS;
        }

        $db = config("database.connections.{$conn}");
        $dir = storage_path('app/backups');
        File::ensureDirectoryExists($dir);

        $file = $dir.'/'.($db['database'] ?? 'database').'-'.now()->format('Y-m-d_His').'.sql.gz';

        $command = sprintf(
            'mysqldump --host=%s --port=%s --user=%s --single-transaction --quick --routines --no-tablespaces %s | gzip > %s',
            escapeshellarg((string) ($db['host'] ?? '127.0.0.1')),
            escapeshellarg((string) ($db['port'] ?? '3306')),
            escapeshellarg((string) ($db['username'] ?? 'root')),
            escapeshellarg((string) $db['database']),
            escapeshellarg($file),
        );

        $process = Process::fromShellCommandline($command, base_path(), [
            'MYSQL_PWD' => (string) ($db['password'] ?? ''),
        ]);
        $process->setTimeout(900);
        $process->run();

        if (! $process->isSuccessful() || ! File::exists($file) || File::size($file) === 0) {
            @File::delete($file);
            $this->error('Backup failed: '.trim($process->getErrorOutput()) ?: 'empty dump');

            return self::FAILURE;
        }

        $this->info('Wrote '.$file.' ('.number_format(File::size($file) / 1024, 1).' KB)');

        $this->pushOffsite($file);

        $keep = (int) $this->option('keep');
        if ($removed = $this->prune($dir, $keep)) {
            $this->info("Pruned {$removed} backup(s) older than {$keep} day(s).");
        }

        return self::SUCCESS;
    }

    /**
     * Best-effort offsite copy of a completed local backup to the `s3` disk.
     * Skips silently (with a comment) if S3 isn't configured. Never fails the
     * command — the local backup already succeeded and matters more.
     */
    protected function pushOffsite(string $file): void
    {
        if (! filled(config('filesystems.disks.s3.bucket'))) {
            $this->comment('S3 not configured (AWS_BUCKET is blank) — skipping offsite backup copy.');

            return;
        }

        try {
            Storage::disk('s3')->put('backups/'.basename($file), File::get($file));
            $this->info('Uploaded '.basename($file).' to the s3 disk (backups/).');
        } catch (Throwable $e) {
            Log::error('Offsite database backup upload failed: '.$e->getMessage(), [
                'file' => $file,
                'exception' => $e,
            ]);
            $this->error('Offsite backup upload failed: '.$e->getMessage());
        }
    }

    /** Delete *.sql.gz backups older than `$keepDays`; returns the count removed. */
    public function prune(string $dir, int $keepDays): int
    {
        $cutoff = Carbon::now()->subDays(max(1, $keepDays));
        $removed = 0;

        foreach (File::glob($dir.'/*.sql.gz') as $path) {
            if (Carbon::createFromTimestamp(File::lastModified($path))->lt($cutoff)) {
                File::delete($path);
                $removed++;
            }
        }

        return $removed;
    }
}
