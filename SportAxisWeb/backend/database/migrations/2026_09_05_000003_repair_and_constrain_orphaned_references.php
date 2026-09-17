<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The second half of the foreign-key audit: columns that DID have dangling
 * values (pointing at a row that no longer exists), so a constraint couldn't
 * be added until the data itself was made consistent.
 *
 * Every affected column here is nullable, so the fix is to null out the
 * dangling value — the row survives, it just correctly shows "no longer
 * linked" instead of silently pointing at nothing. The one exception is
 * `announcements.coach_id`, which is required (an announcement always has an
 * author) and the orphaned rows are real demo content (tryout notices, the
 * opening ceremony schedule, ...) whose original seed author (e.g. "admin-001")
 * was replaced by a newer UUID-keyed seed run — not garbage to delete. Rather
 * than fabricate a specific person as the author, they're reassigned to the
 * current admin account, which can already manage every announcement anyway.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('athletes')->whereNotNull('coach_id')
            ->whereNotIn('coach_id', DB::table('users')->select('id'))
            ->update(['coach_id' => null]);

        // MySQL forbids "UPDATE users ... WHERE x NOT IN (SELECT ... FROM users)" —
        // you can't subquery the same table you're updating. Materialize the
        // valid ids in PHP first instead.
        $userIds = DB::table('users')->pluck('id')->all();
        DB::table('users')->whereNotNull('coach_id')
            ->whereNotIn('coach_id', $userIds)
            ->update(['coach_id' => null]);

        DB::table('bracket_matches')->whereNotNull('event_id')
            ->whereNotIn('event_id', DB::table('events')->select('id'))
            ->update(['event_id' => null]);

        DB::table('performance_records')->whereNotNull('event_id')
            ->whereNotIn('event_id', DB::table('events')->select('id'))
            ->update(['event_id' => null]);

        DB::table('team_matches')->whereNotNull('event_id')
            ->whereNotIn('event_id', DB::table('events')->select('id'))
            ->update(['event_id' => null]);

        DB::table('tryout_applications')->whereNotNull('announcement_id')
            ->whereNotIn('announcement_id', DB::table('announcements')->select('id'))
            ->update(['announcement_id' => null]);

        DB::table('registration_codes')->whereNotNull('used_by')
            ->whereNotIn('used_by', DB::table('users')->select('id'))
            ->update(['used_by' => null]);

        $fallbackAdmin = DB::table('users')->where('role', 'admin')->orderBy('created_at')->value('id');
        $orphanedAnnouncements = DB::table('announcements')
            ->whereNotIn('coach_id', DB::table('users')->select('id'));

        if ($fallbackAdmin) {
            $orphanedAnnouncements->update(['coach_id' => $fallbackAdmin]);
        } else {
            // No admin account exists to reassign to — nothing valid to point
            // at, so these can't be kept.
            $orphanedAnnouncements->delete();
        }

        Schema::table('athletes', fn (Blueprint $t) => $t->foreign('coach_id')->references('id')->on('users')->onDelete('set null'));
        Schema::table('users', fn (Blueprint $t) => $t->foreign('coach_id')->references('id')->on('users')->onDelete('set null'));
        Schema::table('bracket_matches', fn (Blueprint $t) => $t->foreign('event_id')->references('id')->on('events')->onDelete('set null'));
        Schema::table('performance_records', fn (Blueprint $t) => $t->foreign('event_id')->references('id')->on('events')->onDelete('set null'));
        Schema::table('team_matches', fn (Blueprint $t) => $t->foreign('event_id')->references('id')->on('events')->onDelete('set null'));
        Schema::table('tryout_applications', fn (Blueprint $t) => $t->foreign('announcement_id')->references('id')->on('announcements')->onDelete('set null'));
        Schema::table('registration_codes', fn (Blueprint $t) => $t->foreign('used_by')->references('id')->on('users')->onDelete('set null'));
        Schema::table('announcements', fn (Blueprint $t) => $t->foreign('coach_id')->references('id')->on('users')->onDelete('cascade'));
    }

    public function down(): void
    {
        Schema::table('athletes', fn (Blueprint $t) => $t->dropForeign(['coach_id']));
        Schema::table('users', fn (Blueprint $t) => $t->dropForeign(['coach_id']));
        Schema::table('bracket_matches', fn (Blueprint $t) => $t->dropForeign(['event_id']));
        Schema::table('performance_records', fn (Blueprint $t) => $t->dropForeign(['event_id']));
        Schema::table('team_matches', fn (Blueprint $t) => $t->dropForeign(['event_id']));
        Schema::table('tryout_applications', fn (Blueprint $t) => $t->dropForeign(['announcement_id']));
        Schema::table('registration_codes', fn (Blueprint $t) => $t->dropForeign(['used_by']));
        Schema::table('announcements', fn (Blueprint $t) => $t->dropForeign(['coach_id']));

        // The nulled/deleted rows are not restored — there was no valid value
        // to put back.
    }
};
