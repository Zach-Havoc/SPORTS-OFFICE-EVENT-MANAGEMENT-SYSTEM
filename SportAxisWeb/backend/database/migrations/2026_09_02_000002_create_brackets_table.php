<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A persisted tournament bracket for one sport.
 *
 * `bracket_matches` holds the tree; each node links to a scheduled Event and,
 * once its result is in, feeds its winner into the parent node (progression).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('brackets', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('sport');
            $table->enum('format', ['single_elimination', 'round_robin'])->default('single_elimination');
            $table->string('name');
            $table->enum('status', ['draft', 'active', 'completed'])->default('draft');
            $table->boolean('seeded')->default(false);
            $table->string('champion')->nullable();       // department name, set when the final resolves
            $table->json('settings')->nullable();         // startDate, startTime, matchDuration, breakDuration, venueId
            $table->string('created_by')->nullable();
            $table->timestamps();

            $table->index(['sport', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('brackets');
    }
};
