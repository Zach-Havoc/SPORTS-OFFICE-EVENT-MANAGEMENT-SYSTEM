<?php

use Illuminate\Database\Migrations\Migration;

/**
 * Historically seeded the six line categories for each racquet sport
 * (Badminton, Table Tennis): M/W × {Singles A, Singles B, Doubles}.
 *
 * That seeding now lives in `Database\Seeders\ReferenceDataSeeder` instead —
 * inline data-seeding in a migration breaks `php artisan schema:dump`'s
 * fast-install path (the dump only snapshots schema + the migrations table,
 * so a fresh install would mark this migration "already run" without ever
 * inserting the rows). This migration is kept as a no-op so migration
 * history stays intact for databases that already ran it; run
 * `ReferenceDataSeeder` (via `migrate --seed` or `db:seed`) to get this data
 * on a fresh install.
 */
return new class extends Migration
{
    public function up(): void {}

    public function down(): void {}
};
