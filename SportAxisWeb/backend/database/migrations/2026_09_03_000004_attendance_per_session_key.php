<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Attendance is one record per (athlete, date, session) — where "session" is the
 * event, or the sentinel 'training' when there's no event. Previously the app
 * upserted on (athlete, date) only, so a training record and an event record on
 * the same day overwrote each other.
 *
 * Backfills legacy NULL event_ids to 'training' and adds the composite unique
 * index so a concurrent double-save can't create duplicates either.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('attendance_records')->whereNull('event_id')->update(['event_id' => 'training']);

        Schema::table('attendance_records', function (Blueprint $table) {
            $table->string('event_id')->default('training')->nullable(false)->change();
            $table->unique(['athlete_id', 'date', 'event_id'], 'attendance_athlete_date_session_unique');
        });
    }

    public function down(): void
    {
        Schema::table('attendance_records', function (Blueprint $table) {
            $table->dropUnique('attendance_athlete_date_session_unique');
            $table->string('event_id')->nullable()->default(null)->change();
        });
    }
};
