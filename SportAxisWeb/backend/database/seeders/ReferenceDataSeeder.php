<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Baseline reference data the app assumes exists — safe to run against a
 * real production database, unlike DatabaseSeeder (which also creates demo
 * accounts with known passwords and is for local/dev use only).
 *
 * This used to live inline inside three migrations (seed_racquet_disciplines,
 * create_requirement_types_and_threading, add_season_id_to_events_and_brackets).
 * That broke `php artisan schema:dump`'s fast-install path: the dump only
 * snapshots table structure plus the `migrations` tracking table, so a fresh
 * install would mark those migrations "already run" without ever executing
 * their seeding code, silently starting with no racquet lines, no eligibility
 * checklist, and no active season. Moving the data here — and always running
 * it via `--seed` on a fresh install — fixes that regardless of whether the
 * schema was built via a full migration replay or the schema-dump fast path.
 *
 * Idempotent: safe to run against a database that already has this data.
 */
class ReferenceDataSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedRacquetDisciplines();
        $this->seedDefaultRequirementTypes();
        $this->seedDefaultSeason();
    }

    /**
     * The six line categories for each racquet sport (Badminton, Table
     * Tennis): M/W × {Singles A, Singles B, Doubles}. A racquet event isn't a
     * single college-vs-college game — each line runs its own bracket across
     * every college with its own medals, so each line is a normal `versus`
     * category and the existing bracket/standings/medal machinery applies
     * unchanged.
     */
    private function seedRacquetDisciplines(): void
    {
        $sports = ['Badminton', 'Table Tennis'];
        $divisions = ['M Singles A', 'M Singles B', 'M Doubles', 'W Singles A', 'W Singles B', 'W Doubles'];

        foreach ($sports as $sport) {
            foreach ($divisions as $division) {
                $name = "{$sport} — {$division}";

                if (DB::table('categories')->where('name', $name)->exists()) {
                    continue;
                }

                DB::table('categories')->insert([
                    'id' => (string) Str::uuid(),
                    'name' => $name,
                    'description' => "{$sport} {$division} — one bracket across all colleges.",
                    'format' => 'versus',
                    'parent_sport' => $sport,
                    'division' => $division,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    /** The eligibility checklist every athlete sees, until a coach/admin customizes it. */
    private function seedDefaultRequirementTypes(): void
    {
        if (DB::table('requirement_types')->count() > 0) {
            return;
        }

        $defaults = [
            ['name' => 'Waiver Form', 'description' => 'Signed liability waiver.'],
            ['name' => 'Certificate of Enrollment', 'description' => 'Current semester, from the registrar.'],
            ['name' => 'Medical Clearance', 'description' => 'Fit-to-play certificate from a physician.'],
            ['name' => 'Parental Consent', 'description' => 'Required for athletes under 18.'],
        ];

        $now = now();
        DB::table('requirement_types')->insert(array_map(fn ($d) => [
            'id' => (string) Str::uuid(),
            'name' => $d['name'],
            'description' => $d['description'],
            'sport' => null,
            'required' => true,
            'active' => true,
            'created_by' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ], $defaults));
    }

    /**
     * There is always exactly one active tournament edition. Create the
     * default one if this database has none yet — new events attach to it
     * automatically via `Event::creating()` -> `Season::current()`.
     */
    private function seedDefaultSeason(): void
    {
        if (DB::table('seasons')->exists()) {
            return;
        }

        DB::table('seasons')->insert([
            'id' => (string) Str::uuid(),
            'name' => '2025–2026 Intramurals',
            'starts_on' => null,
            'ends_on' => null,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
