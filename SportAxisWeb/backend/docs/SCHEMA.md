# Database schema & fresh installs

## Setting up a brand new database

Two steps, in order — both are required, neither is optional:

```
php artisan migrate --force
php artisan db:seed --class="Database\Seeders\ReferenceDataSeeder" --force
```

`migrate` builds every table. `ReferenceDataSeeder` then fills in the baseline
data the app assumes exists: the eligibility checklist (Waiver Form,
Certificate of Enrollment, Medical Clearance, Parental Consent), the twelve
racquet-sport line categories (Badminton/Table Tennis × Singles A/B/Doubles ×
Men/Women), and the default active season. Skip the seed step and the app
still runs, but athletes see an empty eligibility checklist, racquet line-ups
have nothing to assign, and no event has a season to attach to.

**Do not** run the plain `php artisan db:seed` (no `--class`) against a real
database — that seeds `DatabaseSeeder`, which also creates demo accounts
(`admin@university.edu` etc.) with known, weak passwords, for local
development only.

## Why this is two separate seeders

`ReferenceDataSeeder` (`database/seeders/ReferenceDataSeeder.php`) — safe
anywhere, no accounts, just reference rows.

`DatabaseSeeder` (`database/seeders/DatabaseSeeder.php`) — local/dev
convenience; calls `ReferenceDataSeeder` too, but also creates demo
admin/coach/athlete/judge accounts. Only ever run this one locally
(`php artisan db:seed`, no `--class`, which is what a fresh `composer
install` / local setup should use).

## Why this data lives in a seeder and not a migration

It used to be seeded inline inside three migrations
(`2026_09_03_000003_seed_racquet_disciplines`,
`2026_09_13_000002_create_requirement_types_and_threading`,
`2026_09_10_000002_add_season_id_to_events_and_brackets`). That broke `php
artisan schema:dump`'s fast-install path: the dump only snapshots table
structure plus the `migrations` tracking table's own rows, so on a fresh
database the fast path would mark those three migrations "already run"
without ever executing the code that inserted the rows — a fresh install
would silently end up with an empty checklist, no racquet lines, and no
season, with nothing in the migration output suggesting anything was wrong.

Moving the data into `ReferenceDataSeeder` and always running it as a
separate, explicit step fixes this regardless of whether the schema was built
by replaying every migration or by loading the schema dump.

The test suite handles this automatically — `tests/TestCase.php` sets
`protected $seeder = ReferenceDataSeeder::class;`, so every test using
`RefreshDatabase` gets this data for free without needing `--seed` itself.

## Regenerating the schema dump

After adding new migrations, refresh the snapshot so fresh installs stay
fast:

```
php artisan schema:dump
```

This overwrites `database/schema/mysql-schema.sql` from whatever database
your `.env` currently points at — run it against an up-to-date database
(`php artisan migrate:status` should show nothing pending first). It's a
read-only `mysqldump` under the hood; it does not touch your data.

Existing migration files are kept, not deleted — `schema:dump --prune` is
available if you ever want to remove them, but this project doesn't use it.

## InfinityFree can't use the schema dump at all

Loading the dump on a fresh database shells out to the real `mysql` CLI
binary via Symfony's `Process` component, which needs `proc_open` —
disabled on InfinityFree (confirmed empirically: reproduced locally with
`php -d disable_functions=proc_open artisan migrate --force`, which fails
with `Symfony\Component\Process\Exception\LogicException: The Process
class relies on proc_open...` the instant it tries to load the dump, but
succeeds cleanly via normal per-migration replay once the dump file isn't
present). `database/schema/mysql-schema.sql` is therefore excluded from the
InfinityFree deploy (`deploy-web-infinityfree.yml`'s `exclude:` list) —
that's the *only* environment this matters for; local dev, CI, and any
host with `proc_open` available all keep using the fast dump-loading path
exactly as designed.

## InfinityFree's MySQL also has a stricter index key length limit

New migrations: **give any string column an explicit length if it's going
into a composite (multi-column) unique/index together with another string
column.** `Schema::defaultStringLength(191)` (`AppServiceProvider::boot()`)
already handles a single indexed/unique string column safely, but two
default-length (191-char) `utf8mb4` string columns combined in one
constraint is 1528 bytes — over InfinityFree's 1000-byte limit (confirmed
empirically against the real deploy; local MySQL 8's `innodb_large_prefix`
means this can't be caught by testing locally, only by working out the
byte math by hand: `length * 4` per column, summed across every column in
the constraint). A single string column paired with non-string columns
(integers, enums, dates) is fine regardless of length.

Existing fixed examples to follow: `discipline_entries` (category/department
capped at 80, athlete_id at 36 — matching its real UUID length),
`notifications`/`audit_logs` (their `*_type`/`*_id` polymorphic pairs,
capped at 100/36), `requirement_types` (name/sport, 150/80),
`attendance_records` (athlete_id/event_id, both 36).
