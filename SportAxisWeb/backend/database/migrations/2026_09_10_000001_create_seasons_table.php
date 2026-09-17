<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A tournament edition — one school year's intramurals. Every event (and every
 * score, ranking and bracket reached through it) belongs to exactly one, so a
 * new year starts clean instead of on top of last year's data.
 *
 * Exactly one season is `is_active` at a time; that is the default scope for
 * the public leaderboard, standings and schedule. The app enforces the
 * single-active rule in SeasonController::activate().
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seasons', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name')->unique();
            $table->date('starts_on')->nullable();
            $table->date('ends_on')->nullable();
            $table->boolean('is_active')->default(false);
            $table->timestamps();

            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seasons');
    }
};
