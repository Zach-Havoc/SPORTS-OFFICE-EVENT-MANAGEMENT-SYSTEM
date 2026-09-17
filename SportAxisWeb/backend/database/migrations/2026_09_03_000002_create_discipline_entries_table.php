<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Which athlete plays a given racquet line for a college.
 *
 * The bracket engine still tracks the COLLEGE as the team; this table only
 * supplies the display label ("Santos (CET)") and is owned by the college's
 * coach. A singles line has one row per (category, department); Doubles has
 * two, distinguished by `pair_slot`.
 *
 * `athlete_id` is loose — it may point at `athletes.id` or `users.id`, since
 * an athlete account can exist as either (see AthleteController::index).
 * `athlete_name` is a denormalised snapshot so the label survives roster edits.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('discipline_entries', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('category');                // discipline category name, e.g. "Badminton — M Doubles"
            $table->string('department');              // college name
            $table->string('athlete_id');
            $table->string('athlete_name');
            $table->string('coach_id');
            $table->string('pair_slot')->nullable();   // 'C' | 'D' for doubles; null for singles
            $table->timestamps();

            $table->unique(['category', 'department', 'athlete_id']);
            $table->index(['category', 'department']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('discipline_entries');
    }
};
