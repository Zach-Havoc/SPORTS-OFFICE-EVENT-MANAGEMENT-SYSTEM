<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Seeds the six line categories for each racquet sport (Badminton, Table
 * Tennis): M/W × {Singles A, Singles B, Doubles}.
 *
 * A racquet event isn't a single college-vs-college game — each line runs its
 * own bracket across every college with its own medals. Each line is a normal
 * `versus` category, so the existing bracket / standings / medal machinery
 * applies unchanged. Idempotent — safe to re-run.
 */
return new class extends Migration
{
    public function up(): void
    {
        $sports = ['Badminton', 'Table Tennis'];
        $divisions = ['M Singles A', 'M Singles B', 'M Doubles', 'W Singles A', 'W Singles B', 'W Doubles'];

        foreach ($sports as $sport) {
            foreach ($divisions as $division) {
                $name = "{$sport} — {$division}";

                $attrs = [
                    'format' => 'versus',
                    'parent_sport' => $sport,
                    'division' => $division,
                    'updated_at' => now(),
                ];

                if (DB::table('categories')->where('name', $name)->exists()) {
                    DB::table('categories')->where('name', $name)->update($attrs);

                    continue;
                }

                DB::table('categories')->insert($attrs + [
                    'id' => (string) Str::uuid(),
                    'name' => $name,
                    'description' => "{$sport} {$division} — one bracket across all colleges.",
                    'created_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        foreach (['Badminton', 'Table Tennis'] as $sport) {
            DB::table('categories')->where('parent_sport', $sport)->delete();
        }
    }
};
