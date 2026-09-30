<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * TiDB only (a no-op on MySQL / MariaDB / SQLite).
 *
 * Plays are replayed in id order — the volleyball rally log, the basketball
 * play-by-play, "undo the last play" — and the audit trail pages by id. MySQL
 * hands out AUTO_INCREMENT ids in insert order. TiDB, by default, gives each
 * of its servers its own cached block of ids, so a later play can get a
 * smaller id and a replay would run rallies out of order.
 *
 * TiDB's MySQL-compatible mode (AUTO_ID_CACHE=1) keeps ids in insert order,
 * but it can only be chosen when a table is created — so, on a fresh TiDB
 * database, these tables are recreated with it while still empty. A table
 * that already has rows is left alone (logged): migrate onto an empty
 * TiDB database, then load data.
 */
return new class extends Migration
{
    private const TABLES = ['game_events', 'audit_logs'];

    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql' || ! str_contains((string) (DB::selectOne('SELECT VERSION() AS v')->v ?? ''), 'TiDB')) {
            return;
        }

        foreach (self::TABLES as $table) {
            $create = array_values((array) DB::selectOne("SHOW CREATE TABLE `{$table}`"))[1];
            if (preg_match('/AUTO_ID_CACHE\s*=\s*1\b/i', $create)) {
                continue;
            }
            if (DB::table($table)->exists()) {
                Log::warning("TiDB: {$table} already has rows, so it keeps TiDB's default id caching — play order may not follow ids.");

                continue;
            }
            DB::statement("DROP TABLE `{$table}`");
            DB::statement(rtrim($create).' AUTO_ID_CACHE=1');
        }
    }

    public function down(): void
    {
        // Nothing to undo: the tables keep their columns; only id allocation changed.
    }
};
