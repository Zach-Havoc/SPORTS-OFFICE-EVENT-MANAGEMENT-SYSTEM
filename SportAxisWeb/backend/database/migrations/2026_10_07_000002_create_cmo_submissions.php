<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A coach forwards the athletes whose CMO documents they have approved to
 * the sports office, in batches. The office accepts each athlete or returns
 * them to the coach with a note. One row per athlete per batch; a
 * resubmission is a new row, the latest one is the athlete's office status.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cmo_submissions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('coach_id')->index();
            $table->string('department');
            $table->string('sport')->nullable();
            $table->text('note')->nullable();
            $table->timestamp('submitted_at');
            $table->timestamps();
        });

        Schema::create('cmo_submission_athletes', function (Blueprint $table) {
            $table->id();
            $table->string('submission_id')->index();
            // The id requirements are filed under (athletes.id, or a legacy users.id).
            $table->string('athlete_id')->index();
            $table->string('athlete_name');
            $table->string('department')->index();
            $table->string('sport')->nullable()->index();
            $table->string('division')->nullable();
            $table->enum('status', ['submitted', 'accepted', 'returned'])->default('submitted')->index();
            $table->text('office_note')->nullable();
            $table->string('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->foreign('submission_id')->references('id')->on('cmo_submissions')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cmo_submission_athletes');
        Schema::dropIfExists('cmo_submissions');
    }
};
