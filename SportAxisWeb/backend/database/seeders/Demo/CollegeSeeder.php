<?php

namespace Database\Seeders\Demo;

use App\Services\DemoData\DemoContext;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Exactly the seven colleges. One already on the site under the same name or
 * abbreviation keeps its row (and its logo) and takes the canonical name;
 * missing ones are created; any other college is removed.
 */
class CollegeSeeder extends Seeder
{
    public function run(DemoContext $ctx): void
    {
        $key = fn (?string $v) => mb_strtolower(trim((string) $v));
        $existing = DB::table('departments')->get(['id', 'name', 'abbreviation']);
        $keep = [];

        foreach (DemoContext::COLLEGES as $abbr => $name) {
            $spellings = array_map($key, [$name, $abbr, ...(DemoContext::ALIASES[$abbr] ?? [])]);
            $row = $existing->first(fn ($d) => in_array($key($d->name), $spellings, true) || in_array($key($d->abbreviation), $spellings, true));

            if ($row) {
                DB::table('departments')->where('id', $row->id)->update(['name' => $name, 'abbreviation' => $abbr, 'updated_at' => now()]);
                $keep[] = $row->id;
            } else {
                $keep[] = $id = (string) Str::uuid();
                DB::table('departments')->insert(['id' => $id, 'name' => $name, 'abbreviation' => $abbr, 'created_at' => now(), 'updated_at' => now()]);
            }
        }

        // Anything else goes; an admin's link to it clears itself (FK set null).
        DB::table('departments')->whereNotIn('id', $keep)->delete();

        $ctx->load();
    }
}
