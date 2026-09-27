<?php

namespace App\Services\DemoData;

use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;

/**
 * A plain-SQL dump of the whole database to a file, with the tool the
 * driver needs (mysqldump, pg_dump, sqlite3). Throws when the dump fails
 * or comes out empty — a reset must never run without one.
 */
class DatabaseBackup
{
    public function dump(string $path): string
    {
        $conn = config('database.default');
        $db = config("database.connections.{$conn}");
        File::ensureDirectoryExists(dirname($path));

        [$command, $env] = match ($db['driver'] ?? $conn) {
            'mysql', 'mariadb' => [sprintf(
                'mysqldump --host=%s --port=%s --user=%s --single-transaction --quick --routines --no-tablespaces %s > %s',
                escapeshellarg((string) ($db['host'] ?? '127.0.0.1')), escapeshellarg((string) ($db['port'] ?? '3306')),
                escapeshellarg((string) ($db['username'] ?? 'root')), escapeshellarg((string) $db['database']), escapeshellarg($path),
            ), ['MYSQL_PWD' => (string) ($db['password'] ?? '')]],
            'pgsql' => [sprintf(
                'pg_dump --host=%s --port=%s --username=%s --no-owner --format=plain %s > %s',
                escapeshellarg((string) ($db['host'] ?? '127.0.0.1')), escapeshellarg((string) ($db['port'] ?? '5432')),
                escapeshellarg((string) ($db['username'] ?? 'postgres')), escapeshellarg((string) $db['database']), escapeshellarg($path),
            ), ['PGPASSWORD' => (string) ($db['password'] ?? '')]],
            'sqlite' => [sprintf('sqlite3 %s .dump > %s', escapeshellarg((string) $db['database']), escapeshellarg($path)), []],
            default => throw new \RuntimeException("Backups aren't supported for the {$conn} driver."),
        };

        $process = Process::fromShellCommandline($command, base_path(), $env);
        $process->setTimeout(900);
        $process->run();

        clearstatcache(true, $path);
        if (! $process->isSuccessful() || ! File::exists($path) || File::size($path) === 0) {
            @File::delete($path);
            throw new \RuntimeException('Backup failed: '.(trim($process->getErrorOutput()) ?: 'the dump came out empty'));
        }

        return $path;
    }
}
