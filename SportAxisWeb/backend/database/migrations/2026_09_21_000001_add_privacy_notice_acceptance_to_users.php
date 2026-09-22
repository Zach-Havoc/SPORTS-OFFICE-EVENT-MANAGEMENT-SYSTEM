<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Records that an account holder was shown, and acknowledged, the Data
 * Privacy Notice at signup (RA 10173 requires disclosure of what's collected
 * and why regardless of whether consent is the legal basis — athletes'
 * medical clearance documents are collected as a mandatory eligibility
 * requirement, not on an opt-in basis, so this is an acknowledgment record,
 * not a consent-to-decline mechanism).
 *
 * `privacy_notice_version` lets a future revision of the notice text require
 * re-acknowledgment from existing accounts without conflating it with a
 * fresh signup.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('privacy_notice_accepted_at')->nullable()->after('enrolled_at');
            $table->string('privacy_notice_version')->nullable()->after('privacy_notice_accepted_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['privacy_notice_accepted_at', 'privacy_notice_version']);
        });
    }
};
