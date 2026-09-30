<?php

namespace App\Services\DemoData;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

/**
 * A plain-SQL dump of the whole database to a file, with the tool the
 * driver needs (mysqldump, pg_dump, sqlite3). Where shelling out isn't
 * possible — InfinityFree disables proc_open — a MySQL database is dumped
 * in PHP instead. Throws when no dump could be made or it came out empty:
 * a reset must never run without one.
 */
class DatabaseBackup
{
    public function dump(string $path): string
    {
        File::ensureDirectoryExists(dirname($path));
        $driver = DB::getDriverName();

        if (function_exists('proc_open')) {
            try {
                return $this->withTool($path);
            } catch (\RuntimeException $e) {
                if (! in_array($driver, ['mysql', 'mariadb'], true)) {
                    throw $e;
                }
                Log::warning('Backup tool failed, dumping in PHP instead: '.$e->getMessage());
            }
        }
        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            return $this->inPhp($path);
        }

        throw new \RuntimeException("Backup failed: this server can't run the {$driver} dump tool.");
    }

    private function withTool(string $path): string
    {
        $conn = config('database.default');
        $db = config("database.connections.{$conn}");

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

        return $this->checked($path, $process->isSuccessful() ? null : trim($process->getErrorOutput()));
    }

    /** Every table's CREATE statement and rows, written as it goes. */
    private function inPhp(string $path): string
    {
        $pdo = DB::connection()->getPdo();
        $out = fopen($path, 'w');
        if (! $out) {
            throw new \RuntimeException("Backup failed: can't write {$path}.");
        }

        try {
            fwrite($out, '-- SportAxis backup of '.DB::getDatabaseName().', '.now()->toDateTimeString()." (PHP dump)\n");
            fwrite($out, "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\n\n");

            foreach (DB::select('SHOW FULL TABLES WHERE Table_type = ?', ['BASE TABLE']) as $row) {
                $table = array_values((array) $row)[0];
                $create = array_values((array) DB::selectOne("SHOW CREATE TABLE `{$table}`"))[1];
                fwrite($out, "DROP TABLE IF EXISTS `{$table}`;\n{$create};\n");

                $columns = null;
                $batch = [];
                foreach (DB::table($table)->cursor() as $record) {
                    $record = (array) $record;
                    $columns ??= '`'.implode('`, `', array_keys($record)).'`';
                    $batch[] = '('.implode(', ', array_map(fn ($v) => $v === null ? 'NULL' : $pdo->quote((string) $v), $record)).')';
                    if (count($batch) === 200) {
                        fwrite($out, "INSERT INTO `{$table}` ({$columns}) VALUES\n".implode(",\n", $batch).";\n");
                        $batch = [];
                    }
                }
                if ($batch) {
                    fwrite($out, "INSERT INTO `{$table}` ({$columns}) VALUES\n".implode(",\n", $batch).";\n");
                }
                fwrite($out, "\n");
            }
            fwrite($out, "SET FOREIGN_KEY_CHECKS=1;\n");
        } catch (\Throwable $e) {
            fclose($out);
            @File::delete($path);
            throw new \RuntimeException('Backup failed: '.$e->getMessage(), previous: $e);
        }
        fclose($out);

        return $this->checked($path, null);
    }

    private function checked(string $path, ?string $error): string
    {
        clearstatcache(true, $path);
        if ($error !== null || ! File::exists($path) || File::size($path) === 0) {
            @File::delete($path);
            throw new \RuntimeException('Backup failed: '.($error ?: 'the dump came out empty'));
        }

        return $path;
    }
}
