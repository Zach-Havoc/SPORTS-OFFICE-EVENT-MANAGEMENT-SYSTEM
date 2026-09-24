<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CMO (CHED Memorandum Order) applications — a formal, admin-reviewed
 * application distinct from the generic `requirements` eligibility checklist:
 * athlete-submitted, but always reviewed by the Sports Office admin (never a
 * coach), and carrying its own reference number / CMO citation / school year
 * rather than a freeform name+description.
 *
 * Indexes on athlete_id/status/submitted_at are added from day one — the
 * older `requirements` table shipped without these despite every one of its
 * hot-path queries filtering on exactly these columns.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cmo_applications', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('athlete_id');
            $table->string('athlete_name');
            // Server-generated on submit, never client-supplied. Short and
            // indexable well under InfinityFree's MySQL key-length limit.
            $table->string('reference_no', 40)->unique();
            $table->string('cmo_reference', 150);
            $table->string('school_year', 20);
            $table->string('purpose', 255);
            $table->text('description')->nullable();
            $table->string('file_url')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->text('notes')->nullable();
            $table->string('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();

            $table->index('athlete_id');
            $table->index('status');
            $table->index('submitted_at');
        });

        Schema::table('cmo_applications', function (Blueprint $table) {
            // No FK on athlete_id: like `requirements.athlete_id`, this can
            // hold either an Athlete.id (linked roster record) or a User.id
            // (an athlete account with no linked roster row yet) — see
            // RequirementController::athleteIdFor() for the same fallback.
            $table->foreign('reviewed_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cmo_applications');
    }
};
