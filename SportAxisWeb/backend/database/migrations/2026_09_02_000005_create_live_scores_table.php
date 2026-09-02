<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The running score of a game while it is being played.
 *
 * One row per event. A scorekeeper (committee member or admin) pushes updates
 * from the mobile app as the game progresses; the public Live board and the
 * Match Schedule read it. `detail` is an opaque sport-specific blob (per-quarter
 * points, set scores, fouls …) that the app owns — the backend only cares about
 * the headline `home_score` / `away_score`, the `period`, and the `status`.
 *
 * `version` increments on every write so a stale client can be told to reload.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('live_scores', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('event_id');
            $table->string('sport');                                   // = event.category
            $table->string('home_team')->nullable();
            $table->string('away_team')->nullable();
            $table->unsignedInteger('home_score')->default(0);
            $table->unsignedInteger('away_score')->default(0);
            $table->string('period', 40)->nullable();                  // "Q3", "Set 2", "2nd Half"
            $table->json('detail')->nullable();                        // sport-specific, opaque
            $table->enum('status', ['scheduled', 'in_progress', 'final'])->default('scheduled');
            $table->unsignedInteger('version')->default(0);
            $table->string('updated_by')->nullable();                  // user id of the scorekeeper
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finalized_at')->nullable();
            $table->timestamps();

            $table->unique('event_id');
            $table->index('status');
            $table->foreign('event_id')->references('id')->on('events')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('live_scores');
    }
};
