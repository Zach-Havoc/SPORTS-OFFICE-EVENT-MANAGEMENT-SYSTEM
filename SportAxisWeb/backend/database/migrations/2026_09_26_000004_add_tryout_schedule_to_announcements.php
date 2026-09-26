<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * When and where a tryout is held. A tryout announcement was free text only,
 * so applicants had to read the date out of the body and nobody could be
 * told when it moved.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            $table->date('tryout_date')->nullable()->after('is_tryout');
            $table->string('tryout_start_time', 10)->nullable()->after('tryout_date');
            $table->string('tryout_end_time', 10)->nullable()->after('tryout_start_time');
            $table->string('tryout_venue')->nullable()->after('tryout_end_time');
        });
    }

    public function down(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            $table->dropColumn(['tryout_date', 'tryout_start_time', 'tryout_end_time', 'tryout_venue']);
        });
    }
};
