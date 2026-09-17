<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Indexes for columns the app filters on constantly but that were only ever
 * reachable by full table scan.
 *
 *   requirements.athlete_id       — every roster/own-requirements lookup
 *   performance_records.athlete_id— same, plus the coach roster rollup
 *   events.schedule               — the public schedule is ordered by it and
 *                                   filtered with whereDate() on every load
 *   events.(category, status)     — leaderboard / bracket / filter queries
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('requirements', function (Blueprint $table) {
            $table->index('athlete_id');
        });

        Schema::table('performance_records', function (Blueprint $table) {
            $table->index('athlete_id');
        });

        Schema::table('events', function (Blueprint $table) {
            $table->index('schedule');
            $table->index(['category', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('requirements', fn (Blueprint $t) => $t->dropIndex(['athlete_id']));
        Schema::table('performance_records', fn (Blueprint $t) => $t->dropIndex(['athlete_id']));
        Schema::table('events', function (Blueprint $t) {
            $t->dropIndex(['schedule']);
            $t->dropIndex(['category', 'status']);
        });
    }
};
