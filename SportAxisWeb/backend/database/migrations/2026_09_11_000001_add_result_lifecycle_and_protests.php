<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Trustworthy, defensible results.
 *
 *   scores.status        verified (default) → disputed → verified, or → official
 *                        Only `verified` and `official` scores count toward the
 *                        leaderboard; a disputed score is set aside until it is
 *                        checked and re-verified.
 *   score_amendments     an append-only trail of every after-the-fact edit to a
 *                        score: the old and new values and a required reason.
 *   protests             a college's formal complaint about an event outcome,
 *                        opened by a coach and resolved by the sports office.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('scores', function (Blueprint $table) {
            if (! Schema::hasColumn('scores', 'status')) {
                $table->enum('status', ['verified', 'disputed', 'official'])
                    ->default('verified')->after('total_score');
            }
            if (! Schema::hasColumn('scores', 'dispute_reason')) {
                $table->text('dispute_reason')->nullable()->after('status');
            }
            if (! Schema::hasColumn('scores', 'verified_by')) {
                $table->string('verified_by')->nullable()->after('dispute_reason');
            }
            if (! Schema::hasColumn('scores', 'verified_at')) {
                $table->timestamp('verified_at')->nullable()->after('verified_by');
            }
        });

        Schema::table('scores', function (Blueprint $table) {
            $table->index('status');
            $table->foreign('verified_by')->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('score_amendments', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('score_id');
            $table->string('amended_by');
            $table->json('old_scores')->nullable();
            $table->json('new_scores')->nullable();
            $table->decimal('old_total', 10, 4)->nullable();
            $table->decimal('new_total', 10, 4)->nullable();
            $table->text('reason');
            $table->timestamp('created_at')->nullable();

            $table->index('score_id');
            $table->foreign('score_id')->references('id')->on('scores')->cascadeOnDelete();
            $table->foreign('amended_by')->references('id')->on('users')->restrictOnDelete();
        });

        Schema::create('protests', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('event_id');
            $table->string('season_id')->nullable();
            $table->string('filed_by');
            $table->string('department');
            $table->text('reason');
            $table->enum('status', ['open', 'upheld', 'dismissed'])->default('open');
            $table->text('resolution')->nullable();
            $table->string('resolved_by')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index('event_id');
            $table->index('status');
            $table->index('filed_by');

            $table->foreign('event_id')->references('id')->on('events')->cascadeOnDelete();
            $table->foreign('season_id')->references('id')->on('seasons')->nullOnDelete();
            $table->foreign('filed_by')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('resolved_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('protests');
        Schema::dropIfExists('score_amendments');

        Schema::table('scores', function (Blueprint $table) {
            $table->dropForeign(['verified_by']);
            $table->dropIndex(['status']);
            $table->dropColumn(['status', 'dispute_reason', 'verified_by', 'verified_at']);
        });
    }
};
