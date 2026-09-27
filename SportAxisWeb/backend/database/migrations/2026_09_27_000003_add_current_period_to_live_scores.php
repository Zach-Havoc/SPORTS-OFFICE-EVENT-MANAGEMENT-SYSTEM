<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The period a play-by-play game is in, as a number (1–4, 5+ = OT). The server
 * stamps each play with it, so two scorekeepers' phones can't disagree.
 * `period` stays the display label ("Q3", "OT1") the rest of the app reads.
 * Null for games scored the manual way.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('live_scores', function (Blueprint $table) {
            $table->unsignedTinyInteger('current_period')->nullable()->after('period');
        });
    }

    public function down(): void
    {
        Schema::table('live_scores', function (Blueprint $table) {
            $table->dropColumn('current_period');
        });
    }
};
