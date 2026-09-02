<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One node in a bracket tree.
 *
 * `home_source_match_id` / `away_source_match_id` name the child matches whose
 * winners fill this node's slots. `next_match_id` / `next_match_slot` name the
 * parent slot this node's winner is fed into. `event_id` links to the
 * scheduled Event that is actually played and scored.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bracket_matches', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('bracket_id');
            $table->unsignedInteger('round');                 // 1-based
            $table->unsignedInteger('slot');                  // 0-based position within the round
            $table->string('stage_label');                    // "Round 1", "Semi-Finals", "Finals", "3rd Place"

            $table->string('home_team')->nullable();          // department name; null = TBD
            $table->string('away_team')->nullable();

            $table->string('home_source_match_id')->nullable();
            $table->string('away_source_match_id')->nullable();
            $table->enum('home_source_outcome', ['winner', 'loser'])->default('winner');
            $table->enum('away_source_outcome', ['winner', 'loser'])->default('winner');

            $table->string('next_match_id')->nullable();
            $table->enum('next_match_slot', ['home', 'away'])->nullable();

            $table->date('scheduled_date')->nullable();       // planned slot (the Event is source of truth once published)
            $table->string('scheduled_time')->nullable();     // "HH:MM"
            $table->string('venue_id')->nullable();
            $table->string('venue_name')->nullable();

            $table->string('event_id')->nullable();
            $table->string('winner')->nullable();
            $table->string('loser')->nullable();
            $table->boolean('is_bye')->default(false);
            $table->enum('status', ['pending', 'ready', 'scheduled', 'completed'])->default('pending');

            $table->timestamps();

            $table->index(['bracket_id', 'round', 'slot']);
            $table->index('event_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bracket_matches');
    }
};
