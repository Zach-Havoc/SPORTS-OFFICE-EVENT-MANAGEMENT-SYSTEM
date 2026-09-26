<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-event scoring criteria were never configurable (the column was always
 * an empty list) and the panel dropped them from the study's scope: a judged
 * event is scored with one overall score per college.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('events', 'criteria')) {
            Schema::table('events', fn (Blueprint $table) => $table->dropColumn('criteria'));
        }
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->json('criteria')->nullable()->after('judges');
        });
    }
};
