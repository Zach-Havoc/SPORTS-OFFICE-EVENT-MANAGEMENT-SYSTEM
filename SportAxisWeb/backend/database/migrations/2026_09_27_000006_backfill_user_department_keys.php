<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * `users.department_id` was filled once (2026_09_06_000002) and never kept
 * in step, so accounts created or given a college since then had only the
 * name — and so no games on their schedule or coach Line-up page. User now
 * syncs the key on save; this fills in the accounts saved in between.
 * Data only: it sets empty keys, never changes one that is set.
 */
return new class extends Migration
{
    public function up(): void
    {
        $key = fn (?string $v) => mb_strtolower(trim((string) $v));
        $byKey = [];
        foreach (DB::table('departments')->get(['id', 'name', 'abbreviation']) as $d) {
            $byKey[$key($d->name)] = $d->id;
            if ($d->abbreviation) {
                $byKey[$key($d->abbreviation)] ??= $d->id;
            }
        }

        DB::table('users')->whereNull('department_id')->whereNotNull('department')->where('department', '!=', '')
            ->get(['id', 'department'])
            ->each(function ($u) use ($byKey, $key) {
                if ($id = $byKey[$key($u->department)] ?? null) {
                    DB::table('users')->where('id', $u->id)->update(['department_id' => $id]);
                }
            });
    }

    public function down(): void
    {
        // Nothing to undo: the keys it set are correct.
    }
};
