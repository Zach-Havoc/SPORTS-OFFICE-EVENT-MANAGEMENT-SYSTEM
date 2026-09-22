<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Attach every existing event and bracket to a season (whatever season
 * already exists — `Database\Seeders\ReferenceDataSeeder` is what actually
 * creates the default "2025–2026 Intramurals" edition on a fresh install;
 * that used to happen inline here, but seeding data in a migration breaks
 * `php artisan schema:dump`'s fast-install path). New rows get their season
 * from `Season::current()` via the model `creating` hook.
 *
 * `season_id` is nullable (rows created before a season exists are allowed)
 * with an ON DELETE RESTRICT foreign key — a season with events cannot be
 * deleted, which SeasonController also guards with a friendly 409.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['events', 'brackets'] as $table) {
            if (! Schema::hasColumn($table, 'season_id')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->string('season_id')->nullable()->after('id');
                    $t->index('season_id');
                });
            }
        }

        // Attach pre-existing rows to whichever season already exists, if any
        // (a fresh install has none yet — that's fine, ReferenceDataSeeder
        // creates one afterward and nothing needs backfilling on day one).
        $seasonId = DB::table('seasons')->where('is_active', true)->value('id')
            ?? DB::table('seasons')->value('id');

        DB::table('events')->whereNull('season_id')->update(['season_id' => $seasonId]);
        DB::table('brackets')->whereNull('season_id')->update(['season_id' => $seasonId]);

        foreach (['events', 'brackets'] as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->foreign('season_id')->references('id')->on('seasons')->restrictOnDelete();
            });
        }
    }

    public function down(): void
    {
        foreach (['events', 'brackets'] as $table) {
            if (Schema::hasColumn($table, 'season_id')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->dropForeign(['season_id']);
                    $t->dropIndex(['season_id']);
                    $t->dropColumn('season_id');
                });
            }
        }
    }
};
