<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The athlete's jersey number on their team. A roster detail, so it lives on
 * the roster row (set by the coach, like status), not on the athlete's
 * account. Play-by-play scoring builds each game's roster from it.
 * A string so "0" and "00" stay different jerseys.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('athletes', function (Blueprint $table) {
            $table->string('jersey_number', 2)->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('athletes', function (Blueprint $table) {
            $table->dropColumn('jersey_number');
        });
    }
};
