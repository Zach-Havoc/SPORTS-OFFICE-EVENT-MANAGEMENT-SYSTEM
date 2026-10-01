<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Double elimination: a third bracket format.
 *
 *   brackets.format          + 'double_elimination'
 *   bracket_matches.section  'upper' | 'lower' | 'grand_final' — which part of
 *                            the bracket a match is in (single elimination
 *                            and round robin are all 'upper')
 *   bracket_matches.status   + 'skipped' — the grand-final reset game when the
 *                            upper-bracket champion wins the first grand final
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('brackets', function (Blueprint $table) {
            $table->enum('format', ['single_elimination', 'round_robin', 'double_elimination'])
                ->default('single_elimination')->change();
        });

        Schema::table('bracket_matches', function (Blueprint $table) {
            $table->enum('section', ['upper', 'lower', 'grand_final'])->default('upper')->after('slot');
            $table->enum('status', ['pending', 'ready', 'scheduled', 'completed', 'skipped'])
                ->default('pending')->change();
        });
    }

    public function down(): void
    {
        // Narrowing the enums would fail on (or silently mangle) the rows that
        // use the new values, so those brackets go first.
        $ids = DB::table('brackets')->where('format', 'double_elimination')->pluck('id');
        DB::table('bracket_matches')->whereIn('bracket_id', $ids)->delete();
        DB::table('brackets')->whereIn('id', $ids)->delete();

        Schema::table('bracket_matches', function (Blueprint $table) {
            $table->dropColumn('section');
            $table->enum('status', ['pending', 'ready', 'scheduled', 'completed'])->default('pending')->change();
        });

        Schema::table('brackets', function (Blueprint $table) {
            $table->enum('format', ['single_elimination', 'round_robin'])->default('single_elimination')->change();
        });
    }
};
