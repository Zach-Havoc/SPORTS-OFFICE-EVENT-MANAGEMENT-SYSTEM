<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Volleyball on the play-by-play scorer.
 *
 * game_events
 *   type           a free string instead of the basketball-only enum, so each
 *                  sport names its own plays (KILL, ACE, SET_START, SUB …);
 *                  GameEvent validates them per sport
 *   player_out_id  a substitution's player leaving the court (player_id is
 *                  the one coming on)
 *   detail         a set start's rotations — who starts in positions I–VI
 *
 * game_players
 *   rotation_position  the coach's default starting rotation, 1 (I, the
 *                      server) to 6; the scorer confirms it at each set start
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('game_events', function (Blueprint $table) {
            $table->string('type', 12)->change();
            $table->string('player_out_id')->nullable()->after('player_id');
            $table->json('detail')->nullable()->after('game_clock');

            $table->foreign('player_out_id')->references('id')->on('athletes')->nullOnDelete();
        });

        Schema::table('game_players', function (Blueprint $table) {
            $table->unsignedTinyInteger('rotation_position')->nullable()->after('jersey_number');
        });
    }

    public function down(): void
    {
        Schema::table('game_players', function (Blueprint $table) {
            $table->dropColumn('rotation_position');
        });

        Schema::table('game_events', function (Blueprint $table) {
            $table->dropForeign(['player_out_id']);
            $table->dropColumn(['player_out_id', 'detail']);
        });
        // Rolling back past volleyball plays is not supported: they don't fit
        // the basketball enum. Delete them first if you really need to.
        Schema::table('game_events', function (Blueprint $table) {
            $table->enum('type', ['FG2', 'FG3', 'FT', 'FOUL'])->change();
        });
    }
};
