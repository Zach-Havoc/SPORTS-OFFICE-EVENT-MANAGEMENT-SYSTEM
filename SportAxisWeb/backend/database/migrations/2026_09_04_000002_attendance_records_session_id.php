<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Attendance records now belong to an attendance_session. The record is unique
 * per (session, athlete). The old (athlete, date, event_id) unique — used by
 * the legacy POST /attendance path — is dropped; that path still dedups at the
 * application level via updateOrCreate.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_records', function (Blueprint $table) {
            if (! Schema::hasColumn('attendance_records', 'session_id')) {
                $table->string('session_id')->nullable()->after('id')->index();
            }
        });

        Schema::table('attendance_records', function (Blueprint $table) {
            try {
                $table->dropUnique('attendance_athlete_date_session_unique');
            } catch (Throwable $e) {
                // index may not exist on a fresh install — fine
            }
            $table->unique(['session_id', 'athlete_id'], 'attendance_session_athlete_unique');
        });
    }

    public function down(): void
    {
        Schema::table('attendance_records', function (Blueprint $table) {
            $table->dropUnique('attendance_session_athlete_unique');
            if (Schema::hasColumn('attendance_records', 'session_id')) {
                $table->dropColumn('session_id');
            }
        });
    }
};
