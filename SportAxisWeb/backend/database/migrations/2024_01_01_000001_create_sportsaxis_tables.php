<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. USERS
        Schema::create('users', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('email')->unique();
            $table->string('password');
            $table->string('name');
            $table->enum('role', ['admin', 'coach', 'athlete', 'judge']);
            $table->string('sport')->nullable();
            $table->string('enrollment_code')->nullable()->unique();
            $table->string('coach_id')->nullable();
            $table->string('coach_name')->nullable();
            $table->timestamp('enrolled_at')->nullable();
            $table->timestamps();
        });

        // 2. PERSONAL ACCESS TOKENS (Sanctum)
        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->uuidMorphs('tokenable');
            $table->string('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        // 3. REGISTRATION CODES
        Schema::create('registration_codes', function (Blueprint $table) {
            $table->string('code')->primary();
            $table->enum('role', ['admin', 'coach', 'athlete', 'judge']);
            $table->string('label')->nullable();
            $table->boolean('used')->default(false);
            $table->string('used_by')->nullable();
            $table->string('created_by')->nullable();
            $table->timestamp('used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        // 4. DEPARTMENTS
        Schema::create('departments', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name')->unique();
            $table->string('abbreviation')->nullable();
            $table->timestamps();
        });

        // 5. CATEGORIES
        Schema::create('categories', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name')->unique();
            $table->text('description')->nullable();
            $table->timestamps();
        });

        // 6. VENUES
        Schema::create('venues', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name');
            $table->string('type');
            $table->integer('capacity');
            $table->json('sports')->nullable();
            $table->string('location');
            $table->text('facilities')->nullable();
            $table->enum('status', ['available', 'unavailable', 'maintenance'])->default('available');
            $table->string('created_by')->nullable();
            $table->timestamps();
        });

        // 7. EVENTS
        Schema::create('events', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name');
            $table->string('category');
            $table->date('schedule');
            $table->string('start_time', 10);
            $table->string('end_time', 10);
            $table->string('venue_id')->nullable();
            $table->string('venue_name')->nullable();
            $table->json('departments');
            $table->json('judges')->nullable();
            $table->json('criteria');
            $table->enum('status', ['upcoming', 'ongoing', 'completed'])->default('upcoming');
            $table->string('qr_token')->unique()->nullable();
            $table->timestamps();
        });

        // 8. SCORES
        Schema::create('scores', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('event_id');
            $table->string('department');
            $table->string('judge_id');
            $table->string('judge_name');
            $table->json('scores');
            $table->decimal('total_score', 10, 4);
            $table->boolean('submitted_via_qr')->default(false);
            $table->timestamps();
            $table->foreign('event_id')->references('id')->on('events')->onDelete('cascade');
        });

        // 9. RANKINGS
        Schema::create('rankings', function (Blueprint $table) {
            $table->id();
            $table->string('event_id');
            $table->string('department');
            $table->decimal('total_score', 10, 4);
            $table->integer('judge_count')->default(0);
            $table->integer('rank');
            $table->timestamps();
            $table->foreign('event_id')->references('id')->on('events')->onDelete('cascade');
        });

        // 10. ATHLETES
        Schema::create('athletes', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('student_id')->unique();
            $table->string('first_name');
            $table->string('last_name');
            $table->string('email');
            $table->string('department')->nullable();
            $table->string('year_level')->nullable();
            $table->string('course')->nullable();
            $table->string('coach_id')->nullable();
            $table->string('sport')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->json('emergency_contact')->nullable();
            $table->boolean('enrolled_via_code')->default(false);
            $table->timestamp('enrolled_at')->nullable();
            $table->timestamps();
        });

        // 11. ANNOUNCEMENTS
        Schema::create('announcements', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('title');
            $table->text('content');
            $table->string('sport')->nullable();
            $table->string('coach_id');
            $table->string('coach_name');
            $table->timestamps();
        });

        // 12. TRYOUT APPLICATIONS
        Schema::create('tryout_applications', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('announcement_id')->nullable();
            $table->string('sport')->nullable();
            $table->string('coach_id')->nullable();
            $table->string('first_name');
            $table->string('last_name');
            $table->string('email');
            $table->string('student_id');
            $table->string('department');
            $table->string('phone');
            $table->string('year_level')->default('1st Year');
            $table->enum('status', ['pending', 'accepted', 'rejected'])->default('pending');
            $table->timestamp('applied_at')->nullable();
            $table->timestamps();
        });

        // 13. ATTENDANCE RECORDS
        Schema::create('attendance_records', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('athlete_id');
            $table->string('event_id')->nullable();
            $table->date('date');
            $table->enum('status', ['present', 'absent', 'late', 'excused'])->default('present');
            $table->text('notes')->nullable();
            $table->string('recorded_by');
            $table->timestamp('recorded_at')->nullable();
            $table->timestamps();
        });

        // 14. PERFORMANCE RECORDS
        Schema::create('performance_records', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('athlete_id');
            $table->string('athlete_name');
            $table->string('event_id')->nullable();
            $table->string('event_name')->nullable();
            $table->string('sport')->nullable();
            $table->json('metrics')->nullable();
            $table->integer('overall_rating')->default(5);
            $table->text('coach_notes')->nullable();
            $table->string('recorded_by');
            $table->timestamp('recorded_at')->nullable();
            $table->timestamps();
        });

        // 15. REQUIREMENTS
        Schema::create('requirements', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('athlete_id');
            $table->string('athlete_name');
            $table->string('type');
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('file_url')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->text('notes')->nullable();
            $table->string('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();
        });

        // 16. EMAIL VERIFICATIONS
        Schema::create('email_verifications', function (Blueprint $table) {
            $table->id();
            $table->string('email')->index();
            $table->string('code', 6);
            $table->timestamp('expires_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_verifications');
        Schema::dropIfExists('requirements');
        Schema::dropIfExists('performance_records');
        Schema::dropIfExists('attendance_records');
        Schema::dropIfExists('tryout_applications');
        Schema::dropIfExists('announcements');
        Schema::dropIfExists('athletes');
        Schema::dropIfExists('rankings');
        Schema::dropIfExists('scores');
        Schema::dropIfExists('events');
        Schema::dropIfExists('venues');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('departments');
        Schema::dropIfExists('registration_codes');
        Schema::dropIfExists('personal_access_tokens');
        Schema::dropIfExists('users');
    }
};
