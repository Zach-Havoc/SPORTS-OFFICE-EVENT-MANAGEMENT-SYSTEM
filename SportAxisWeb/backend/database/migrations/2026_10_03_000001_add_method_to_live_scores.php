<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * How the committee is scoring the game: `live` in the app (the public sees
 * the running score) or `paper` on the printed scoresheet (the public sees
 * "In progress" with no score until the sheet's final is recorded).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('live_scores', function (Blueprint $table) {
            $table->string('method', 10)->default('live')->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('live_scores', function (Blueprint $table) {
            $table->dropColumn('method');
        });
    }
};
