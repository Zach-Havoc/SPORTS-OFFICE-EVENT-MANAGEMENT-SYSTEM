<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `discipline_entries.department` was 80 characters, but "College of
 * Accountancy, Business, Economics, and International Hospitality
 * Management" is 85 — so that college's coaches couldn't save a racquet line
 * (strict mode: data too long). 120 still keeps the unique (category,
 * department, athlete_id) key under InfinityFree's 1000-byte index limit:
 * (80 + 120 + 36) × 4 = 944.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('discipline_entries', function (Blueprint $table) {
            $table->string('department', 120)->change();
        });
    }

    public function down(): void
    {
        Schema::table('discipline_entries', function (Blueprint $table) {
            $table->string('department', 80)->change();
        });
    }
};
