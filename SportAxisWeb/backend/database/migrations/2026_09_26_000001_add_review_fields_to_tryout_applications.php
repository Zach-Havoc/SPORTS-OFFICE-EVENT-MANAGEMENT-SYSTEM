<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Who decided a tryout application, when, and why. The `status` column has
 * existed since the first schema but nothing ever set it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tryout_applications', function (Blueprint $table) {
            $table->string('reviewed_by')->nullable()->after('status');
            $table->timestamp('reviewed_at')->nullable()->after('reviewed_by');
            $table->text('review_note')->nullable()->after('reviewed_at');

            $table->foreign('reviewed_by')->references('id')->on('users')->nullOnDelete();
            $table->index(['coach_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('tryout_applications', function (Blueprint $table) {
            $table->dropForeign(['reviewed_by']);
            $table->dropIndex(['coach_id', 'status']);
            $table->dropColumn(['reviewed_by', 'reviewed_at', 'review_note']);
        });
    }
};
