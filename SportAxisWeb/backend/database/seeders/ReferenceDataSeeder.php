<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
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
 *
 * Also loads database/seeders/data/dev_snapshot.php if present — a real
 * data export (accounts, events, brackets, scores) committed to git so a
 * fresh install doesn't start empty. See seedLocalSnapshot() and that
 * file's own docblock.
 */
class ReferenceDataSeeder extends Seeder
{
    public function run(): void
    {
        // Order matters: the snapshot (if present) carries its own specific
        // UUIDs for categories/requirement_types/seasons, cross-referenced
        // by its own events/discipline_entries/etc. Loading it FIRST lets
        // the three methods below correctly detect "already seeded" (they
        // each check-before-insert) and skip — loading it last would
        // instead race them: their fresh random UUIDs would claim the same
        // `categories.name` unique slot first, silently blocking the
        // snapshot's own rows via INSERT IGNORE and leaving its events
        // pointing at category_ids that were never created.
        //
        // NOT run during tests: tests/TestCase.php sets this class as the
        // seeder for every RefreshDatabase test, which is meant to apply
        // only the small baseline (a dozen categories, 4 requirement types,
        // 1 season) — loading 48 users/34 events/etc. on top broke ~45
        // tests that assert specific row counts the moment this was tried.
        if (! app()->environment('testing')) {
            $this->seedLocalSnapshot();
        }
        $this->seedRacquetDisciplines();
        $this->seedDefaultRequirementTypes();
        $this->seedDefaultSeason();
    }

    /**
     * Loads database/seeders/data/dev_snapshot.php — a real data export
     * (accounts, events, brackets, scores, etc.) from a working database,
     * so a fresh install doesn't start empty. Committed to git (see that
     * file's own docblock for what's deliberately excluded and why —
     * personal_access_tokens and sessions must never be added back).
     *
     * insertOrIgnore per table, wrapped with foreign key checks disabled:
     * the export lists tables alphabetically, not dependency order, so
     * inserting e.g. athletes before users would otherwise fail on the
     * foreign key. Silently does nothing if the file is ever missing (kept
     * as a guard, not because that's expected — this file is committed).
     */
    private function seedLocalSnapshot(): void
    {
        $path = database_path('seeders/data/dev_snapshot.php');

        if (! file_exists($path)) {
            return;
        }

        Schema::disableForeignKeyConstraints();

        foreach (require $path as $table => $rows) {
            if ($rows === [] || ! Schema::hasTable($table)) {
                continue;
            }
            // The export can predate a dropped column; insert only what the
            // current schema still has so an old snapshot keeps loading.
            $columns = array_flip(Schema::getColumnListing($table));
            DB::table($table)->insertOrIgnore(array_map(
                fn ($row) => array_intersect_key($row, $columns),
                $rows,
            ));
        }

        Schema::enableForeignKeyConstraints();
    }

    /**
     * The six line categories for each racquet sport (Badminton, Table
     * Tennis): M/W × {Singles A, Singles B, Doubles}. A racquet event isn't a
     * single college-vs-college game — each line runs its own bracket across
     * every college with its own medals, so each line is a normal `versus`
     * category and the existing bracket/standings/medal machinery applies
     * unchanged.
     */
    public function seedRacquetDisciplines(): void
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
    public function seedDefaultRequirementTypes(): void
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
    public function seedDefaultSeason(): void
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
