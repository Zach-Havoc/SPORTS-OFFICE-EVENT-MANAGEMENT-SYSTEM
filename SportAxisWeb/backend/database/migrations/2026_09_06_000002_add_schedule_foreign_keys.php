<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Real keys for "which games is this athlete's team playing".
 *
 * Until now a team was matched by comparing text: `events.departments` holds
 * full college names ("College of Informatics and Computing Sciences") while
 * `users.department` mostly holds abbreviations ("CICS"), so a string match
 * would have returned an empty schedule for 29 of 31 athletes. Sport had the
 * same problem, plus racquet disciplines ("Badminton — M Singles B") that only
 * relate to their parent sport through another name string.
 *
 * This adds the keys and backfills them, matching on name OR abbreviation.
 * The existing text columns stay and keep working — nothing reads the keys yet
 * except the athlete schedule.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── the competing colleges of an event ────────────────────────────
        if (! Schema::hasTable('event_department')) {
            Schema::create('event_department', function (Blueprint $table) {
                // Explicit shorter lengths, not the default 191: these two
                // form the composite primary key below — at utf8mb4's 4
                // bytes/char, 191+191 exceeds InfinityFree's MySQL 1000-byte
                // index key limit (confirmed empirically). Both only ever
                // hold a 36-char UUID (events.id / departments.id).
                $table->string('event_id', 36);
                $table->string('department_id', 36);
                $table->primary(['event_id', 'department_id']);
                $table->index('department_id');
                $table->foreign('event_id')->references('id')->on('events')->onDelete('cascade');
                $table->foreign('department_id')->references('id')->on('departments')->onDelete('cascade');
            });
        }

        // ── the sport an event is played under ────────────────────────────
        Schema::table('events', function (Blueprint $table) {
            if (! Schema::hasColumn('events', 'category_id')) {
                $table->string('category_id')->nullable()->after('category');
                $table->foreign('category_id')->references('id')->on('categories')->onDelete('set null');
            }
        });

        // ── a racquet discipline's parent sport ───────────────────────────
        Schema::table('categories', function (Blueprint $table) {
            if (! Schema::hasColumn('categories', 'parent_id')) {
                $table->string('parent_id')->nullable()->after('parent_sport');
                $table->foreign('parent_id')->references('id')->on('categories')->onDelete('cascade');
            }
        });

        // ── the athlete's own college and sport ───────────────────────────
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'department_id')) {
                $table->string('department_id')->nullable()->after('department');
                $table->foreign('department_id')->references('id')->on('departments')->onDelete('set null');
            }
        });

        Schema::table('athletes', function (Blueprint $table) {
            if (! Schema::hasColumn('athletes', 'category_id')) {
                $table->string('category_id')->nullable()->after('sport');
                $table->foreign('category_id')->references('id')->on('categories')->onDelete('set null');
            }
        });

        // ── backfill ──────────────────────────────────────────────────────
        $depts = DB::table('departments')->get(['id', 'name', 'abbreviation']);
        $deptBy = [];
        foreach ($depts as $d) {
            $deptBy[mb_strtolower(trim($d->name))] = $d->id;
            if ($d->abbreviation) {
                $deptBy[mb_strtolower(trim($d->abbreviation))] = $d->id;
            }
        }
        $catBy = [];
        foreach (DB::table('categories')->get(['id', 'name']) as $c) {
            $catBy[mb_strtolower(trim($c->name))] = $c->id;
        }
        $key = fn (?string $v) => mb_strtolower(trim((string) $v));

        foreach (DB::table('events')->get(['id', 'category', 'departments']) as $e) {
            if ($cid = $catBy[$key($e->category)] ?? null) {
                DB::table('events')->where('id', $e->id)->update(['category_id' => $cid]);
            }
            foreach (json_decode($e->departments ?? '[]', true) ?: [] as $name) {
                if ($did = $deptBy[$key($name)] ?? null) {
                    DB::table('event_department')->insertOrIgnore([
                        'event_id' => $e->id,
                        'department_id' => $did,
                    ]);
                }
            }
        }

        foreach (DB::table('categories')->whereNotNull('parent_sport')->get(['id', 'parent_sport']) as $c) {
            if ($pid = $catBy[$key($c->parent_sport)] ?? null) {
                DB::table('categories')->where('id', $c->id)->update(['parent_id' => $pid]);
            }
        }

        foreach (DB::table('users')->whereNotNull('department')->get(['id', 'department']) as $u) {
            if ($did = $deptBy[$key($u->department)] ?? null) {
                DB::table('users')->where('id', $u->id)->update(['department_id' => $did]);
            }
        }

        foreach (DB::table('athletes')->whereNotNull('sport')->get(['id', 'sport']) as $a) {
            if ($cid = $catBy[$key($a->sport)] ?? null) {
                DB::table('athletes')->where('id', $a->id)->update(['category_id' => $cid]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('event_department');

        Schema::table('events', function (Blueprint $t) {
            $t->dropForeign(['category_id']);
            $t->dropColumn('category_id');
        });
        Schema::table('categories', function (Blueprint $t) {
            $t->dropForeign(['parent_id']);
            $t->dropColumn('parent_id');
        });
        Schema::table('users', function (Blueprint $t) {
            $t->dropForeign(['department_id']);
            $t->dropColumn('department_id');
        });
        Schema::table('athletes', function (Blueprint $t) {
            $t->dropForeign(['category_id']);
            $t->dropColumn('category_id');
        });
    }
};
