<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Head-to-head match records — the factual "Team A beat Team B, 78–65" layer.
 *
 * The mobile app scores an event; when a 2-team event has both teams' scores,
 * a `team_matches` row is derived automatically (see ScoreController). Admins
 * can also enter results directly (forfeits, off-schedule games, corrections).
 *
 * Standings (wins / losses / points for-against / differential) are computed
 * from this table and used to SEED brackets.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('team_matches', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('sport');                                   // = event.category
            $table->string('stage')->default('elimination');           // elimination | round_robin | quarterfinal | semifinal | final | third_place
            $table->string('event_id')->nullable();                    // scheduled Event this result came from
            $table->string('home_team');                               // department name
            $table->string('away_team');                               // department name
            $table->decimal('home_score', 10, 2)->nullable();
            $table->decimal('away_score', 10, 2)->nullable();
            $table->string('winner')->nullable();                      // department name; null while unplayed or drawn
            $table->boolean('is_draw')->default(false);
            $table->enum('status', ['scheduled', 'completed', 'forfeit'])->default('scheduled');
            $table->timestamp('played_at')->nullable();
            $table->string('recorded_by')->nullable();
            $table->timestamps();

            $table->index(['sport', 'status']);
            $table->unique('event_id');                                // one derived result per scheduled event
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('team_matches');
    }
};
