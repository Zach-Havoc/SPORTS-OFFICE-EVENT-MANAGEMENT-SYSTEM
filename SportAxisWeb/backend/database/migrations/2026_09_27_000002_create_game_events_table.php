<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Play-by-play for a basketball game. Every basket, free throw and foul is one
 * row; the score is always computed from these rows, never stored as a
 * running total (live_scores.home_score / away_score are a synced cache).
 *
 * Undo soft-deletes the latest row, so the audit trail keeps it.
 * `player_id` is optional for scoring plays (assigned later) and required for
 * fouls — enforced by the API, not the schema.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_events', function (Blueprint $table) {
            $table->id();
            $table->string('game_id');
            $table->string('team_id');
            $table->string('player_id')->nullable();
            $table->enum('type', ['FG2', 'FG3', 'FT', 'FOUL']);
            $table->unsignedTinyInteger('period');              // 1–4 regulation, 5+ overtime
            $table->string('game_clock', 10)->nullable();       // "07:42"
            $table->string('recorded_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['game_id', 'deleted_at', 'id']);

            $table->foreign('game_id')->references('id')->on('events')->cascadeOnDelete();
            $table->foreign('team_id')->references('id')->on('departments')->cascadeOnDelete();
            // Removing an athlete keeps their points on the board as unassigned.
            $table->foreign('player_id')->references('id')->on('athletes')->nullOnDelete();
            $table->foreign('recorded_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_events');
    }
};
