<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The registrar's roster of real, enrolled students — the single source of
 * truth for who is actually a campus student. An athlete account can only be
 * created if its SR Code + name match a row here (see AuthController::signup).
 *
 * Populated by an admin uploading a CSV export in Settings → Students.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('campus_students', function (Blueprint $table) {
            $table->string('sr_code')->primary();       // e.g. "23-75760"
            $table->string('first_name');
            $table->string('last_name');
            $table->string('middle_name')->nullable();
            $table->string('gender')->nullable();       // "Male" | "Female" | free text
            $table->string('college')->nullable();
            $table->string('program')->nullable();
            $table->string('year_level')->nullable();
            $table->string('email')->nullable();
            $table->timestamps();

            $table->index('last_name');
        });

        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'sr_code')) {
                $table->string('sr_code')->nullable()->unique()->after('email');
            }
            if (! Schema::hasColumn('users', 'gender')) {
                $table->string('gender')->nullable()->after('sr_code');
            }
            if (! Schema::hasColumn('users', 'student_verified_at')) {
                $table->timestamp('student_verified_at')->nullable()->after('gender');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            foreach (['sr_code', 'gender', 'student_verified_at'] as $col) {
                if (Schema::hasColumn('users', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::dropIfExists('campus_students');
    }
};
