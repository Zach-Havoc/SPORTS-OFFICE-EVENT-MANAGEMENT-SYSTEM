<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A training session can be named ("Morning drills", "Conditioning") so a coach
 * can run more than one in a day and tell them apart in history. The session
 * identity lives in `event_id` ('training' or 'training:<slug>'); this column
 * just carries the human label for display.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('attendance_records', 'session_label')) {
            Schema::table('attendance_records', function (Blueprint $table) {
                $table->string('session_label', 80)->nullable()->after('event_id');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('attendance_records', 'session_label')) {
            Schema::table('attendance_records', function (Blueprint $table) {
                $table->dropColumn('session_label');
            });
        }
    }
};
