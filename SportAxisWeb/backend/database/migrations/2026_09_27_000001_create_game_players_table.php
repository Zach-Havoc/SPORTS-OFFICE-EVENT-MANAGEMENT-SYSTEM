<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The roster of one game: which athletes play for which college, under which
 * jersey number. Play-by-play scoring only attributes a play to a player on
 * this list, for that team, in that game.
 *
 * `game_id` is the event's id (a game is an event); `team_id` is the college.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_players', function (Blueprint $table) {
            $table->id();
            $table->string('game_id');
            $table->string('team_id');
            $table->string('player_id');
            $table->string('jersey_number', 3);                 // "0" and "00" are different jerseys
            $table->boolean('is_starter')->default(false);
            $table->timestamps();

            $table->unique(['game_id', 'player_id']);
            $table->unique(['game_id', 'team_id', 'jersey_number']);

            $table->foreign('game_id')->references('id')->on('events')->cascadeOnDelete();
            $table->foreign('team_id')->references('id')->on('departments')->cascadeOnDelete();
            $table->foreign('player_id')->references('id')->on('athletes')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_players');
    }
};
