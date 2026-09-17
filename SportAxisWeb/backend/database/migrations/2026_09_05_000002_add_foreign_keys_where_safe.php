<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Turn "looks like a reference" string columns into real, DB-enforced foreign
 * keys — for every relationship that is currently clean (no dangling values)
 * and has one unambiguous target table.
 *
 * Deliberately EXCLUDED (see the audit shared with the user instead of guessing
 * silently here):
 *   - columns with existing orphaned rows (athletes.coach_id, users.coach_id,
 *     announcements.coach_id, bracket_matches.event_id, team_matches.event_id,
 *     performance_records.event_id, tryout_applications.announcement_id,
 *     registration_codes.used_by) — adding a constraint now would require
 *     deciding what to do with rows that already violate it; that's a data
 *     call for the user, not something to silently delete/null here.
 *   - discipline_entries.athlete_id, performance_records.athlete_id,
 *     requirements.athlete_id — the app can still write either an
 *     `athletes.id` or a raw `users.id` into these (a coachless athlete's
 *     self-submission path), so they aren't a single-target FK yet.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('athletes', function (Blueprint $table) {
            $table->foreign('user_id')->references('id')->on('users')->onDelete('set null');
        });

        Schema::table('attendance_records', function (Blueprint $table) {
            $table->foreign('athlete_id')->references('id')->on('athletes')->onDelete('cascade');
            $table->foreign('session_id')->references('id')->on('attendance_sessions')->onDelete('cascade');
            $table->foreign('recorded_by')->references('id')->on('users')->onDelete('restrict');
        });

        Schema::table('attendance_sessions', function (Blueprint $table) {
            $table->foreign('coach_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('restrict');
        });

        Schema::table('bracket_matches', function (Blueprint $table) {
            $table->foreign('bracket_id')->references('id')->on('brackets')->onDelete('cascade');
            $table->foreign('venue_id')->references('id')->on('venues')->onDelete('set null');
        });

        Schema::table('discipline_entries', function (Blueprint $table) {
            $table->foreign('coach_id')->references('id')->on('users')->onDelete('cascade');
        });

        Schema::table('events', function (Blueprint $table) {
            $table->foreign('venue_id')->references('id')->on('venues')->onDelete('set null');
        });

        Schema::table('registration_codes', function (Blueprint $table) {
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
        });

        Schema::table('scores', function (Blueprint $table) {
            $table->foreign('judge_id')->references('id')->on('users')->onDelete('restrict');
        });

        Schema::table('team_matches', function (Blueprint $table) {
            $table->foreign('recorded_by')->references('id')->on('users')->onDelete('set null');
        });

        Schema::table('tryout_applications', function (Blueprint $table) {
            $table->foreign('coach_id')->references('id')->on('users')->onDelete('set null');
        });

        Schema::table('venues', function (Blueprint $table) {
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
        });

        Schema::table('brackets', function (Blueprint $table) {
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
        });

        Schema::table('site_slides', function (Blueprint $table) {
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
        });

        Schema::table('live_scores', function (Blueprint $table) {
            $table->foreign('updated_by')->references('id')->on('users')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('athletes', fn (Blueprint $t) => $t->dropForeign(['user_id']));
        Schema::table('attendance_records', function (Blueprint $t) {
            $t->dropForeign(['athlete_id']);
            $t->dropForeign(['session_id']);
            $t->dropForeign(['recorded_by']);
        });
        Schema::table('attendance_sessions', function (Blueprint $t) {
            $t->dropForeign(['coach_id']);
            $t->dropForeign(['created_by']);
        });
        Schema::table('bracket_matches', function (Blueprint $t) {
            $t->dropForeign(['bracket_id']);
            $t->dropForeign(['venue_id']);
        });
        Schema::table('discipline_entries', fn (Blueprint $t) => $t->dropForeign(['coach_id']));
        Schema::table('events', fn (Blueprint $t) => $t->dropForeign(['venue_id']));
        Schema::table('registration_codes', fn (Blueprint $t) => $t->dropForeign(['created_by']));
        Schema::table('scores', fn (Blueprint $t) => $t->dropForeign(['judge_id']));
        Schema::table('team_matches', fn (Blueprint $t) => $t->dropForeign(['recorded_by']));
        Schema::table('tryout_applications', fn (Blueprint $t) => $t->dropForeign(['coach_id']));
        Schema::table('venues', fn (Blueprint $t) => $t->dropForeign(['created_by']));
        Schema::table('brackets', fn (Blueprint $t) => $t->dropForeign(['created_by']));
        Schema::table('site_slides', fn (Blueprint $t) => $t->dropForeign(['created_by']));
        Schema::table('live_scores', fn (Blueprint $t) => $t->dropForeign(['updated_by']));
    }
};
