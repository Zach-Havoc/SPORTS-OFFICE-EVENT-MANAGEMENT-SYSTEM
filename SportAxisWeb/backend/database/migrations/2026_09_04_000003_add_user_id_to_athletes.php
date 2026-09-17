<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Consolidate an athlete's identity onto ONE record: their `users` account.
 *
 * Before this, the same person's name / email / college / year / course lived
 * in BOTH `users` (their login) and `athletes` (the coach's roster row), so a
 * rename on one side never reached the other. From here on:
 *
 *   - `users`      = the whole person + profile (name, email, SR code, gender,
 *                    college, year level, course, phone, emergency contact).
 *   - `athletes`   = roster membership only — which coach, which sport, status —
 *                    plus `user_id` pointing at the account that owns the
 *                    identity. Its old identity columns are kept for the rare
 *                    coach-added athlete who has no account yet.
 *
 * The backfill links every roster row to its account by email and copies any
 * profile field the account was missing UP to the account (never the name —
 * the account's name always wins).
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── athletes: add the link, relax legacy constraints ──────────────
        if (! Schema::hasColumn('athletes', 'user_id')) {
            Schema::table('athletes', function (Blueprint $table) {
                $table->string('user_id')->nullable()->after('id')->index();
            });
        }

        Schema::table('athletes', function (Blueprint $table) {
            // Identity now lives on the account; a membership row can be blank here.
            $table->string('student_id')->nullable()->change();
            $table->string('first_name')->nullable()->change();
            $table->string('last_name')->nullable()->change();
            $table->string('email')->nullable()->change();
            // "Injured" was offered in the UI but never valid at the column level.
            $table->enum('status', ['active', 'inactive', 'injured'])->default('active')->change();
        });

        // ── users: it now holds the full athlete profile ─────────────────
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'year_level')) {
                $table->string('year_level')->nullable()->after('department');
            }
            if (! Schema::hasColumn('users', 'course')) {
                $table->string('course')->nullable()->after('year_level');
            }
            if (! Schema::hasColumn('users', 'phone')) {
                $table->string('phone')->nullable()->after('course');
            }
            if (! Schema::hasColumn('users', 'emergency_contact')) {
                $table->json('emergency_contact')->nullable()->after('phone');
            }
        });

        // ── backfill ─────────────────────────────────────────────────────
        $accounts = DB::table('users')->where('role', 'athlete')
            ->get(['id', 'email', 'name', 'department', 'year_level', 'course', 'sport', 'coach_id', 'enrolled_at']);

        $byEmail = [];
        foreach ($accounts as $u) {
            $byEmail[mb_strtolower(trim((string) $u->email))] = $u;
        }

        // 1. Link roster rows to accounts by email; lift any profile detail the
        //    account is missing onto the account.
        foreach (DB::table('athletes')->whereNull('user_id')->get() as $a) {
            $acct = $byEmail[mb_strtolower(trim((string) $a->email))] ?? null;
            if (! $acct) {
                continue;
            }

            DB::table('athletes')->where('id', $a->id)->update([
                'user_id' => $acct->id,
                'updated_at' => now(),
            ]);

            $lift = [];
            if (empty($acct->department) && ! empty($a->department)) {
                $lift['department'] = $a->department;
            }
            if (empty($acct->year_level) && ! empty($a->year_level)) {
                $lift['year_level'] = $a->year_level;
            }
            if (empty($acct->course) && ! empty($a->course)) {
                $lift['course'] = $a->course;
            }
            if (! empty($a->emergency_contact)) {
                $lift['emergency_contact'] = $a->emergency_contact;
            }
            if (! empty($a->sport) && empty($acct->sport)) {
                $lift['sport'] = $a->sport;
            }
            if ($lift) {
                $lift['updated_at'] = now();
                DB::table('users')->where('id', $acct->id)->update($lift);
            }
        }

        // 2. Give every code-enrolled athlete a membership row if they lack one.
        $haveRow = array_flip(DB::table('athletes')->whereNotNull('user_id')->pluck('user_id')->all());

        foreach ($accounts as $u) {
            if (! $u->coach_id || isset($haveRow[$u->id])) {
                continue;
            }

            DB::table('athletes')->insert([
                'id' => (string) Str::uuid(),
                'user_id' => $u->id,
                'student_id' => null,
                'first_name' => '',   // identity lives on the account now
                'last_name' => '',
                'email' => $u->email,
                'department' => null,
                'year_level' => null,
                'course' => null,
                'coach_id' => $u->coach_id,
                'sport' => $u->sport,
                'status' => 'active',
                'emergency_contact' => null,
                'enrolled_via_code' => true,
                'enrolled_at' => $u->enrolled_at,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('athletes', 'user_id')) {
            DB::table('athletes')
                ->whereNotNull('user_id')
                ->where('enrolled_via_code', true)
                ->whereNull('student_id')
                ->delete();

            DB::table('athletes')->where('status', 'injured')->update(['status' => 'inactive']);
            foreach (['first_name', 'last_name', 'email'] as $col) {
                DB::table('athletes')->whereNull($col)->update([$col => '']);
            }

            Schema::table('athletes', function (Blueprint $table) {
                $table->string('first_name')->nullable(false)->change();
                $table->string('last_name')->nullable(false)->change();
                $table->string('email')->nullable(false)->change();
                $table->enum('status', ['active', 'inactive'])->default('active')->change();
                $table->dropIndex(['user_id']);
                $table->dropColumn('user_id');
            });
        }

        Schema::table('users', function (Blueprint $table) {
            foreach (['year_level', 'course', 'phone', 'emergency_contact'] as $col) {
                if (Schema::hasColumn('users', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
