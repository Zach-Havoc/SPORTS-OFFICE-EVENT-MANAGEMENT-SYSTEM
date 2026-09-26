<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A training session was only a title and a date, which is enough to take
 * attendance but not to schedule training: athletes need to know when and
 * where, and the weekly generator needs a time and venue to check clashes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_sessions', function (Blueprint $table) {
            $table->string('start_time', 10)->nullable()->after('date');
            $table->string('end_time', 10)->nullable()->after('start_time');
            $table->string('venue_name')->nullable()->after('end_time');
            $table->index(['coach_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::table('attendance_sessions', function (Blueprint $table) {
            $table->dropIndex(['coach_id', 'date']);
            $table->dropColumn(['start_time', 'end_time', 'venue_name']);
        });
    }
};
