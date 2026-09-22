# dev_snapshot.sql — real data export, not committed

`ReferenceDataSeeder` loads `dev_snapshot.sql` from this folder if it
exists (see that file's `seedLocalSnapshot()` method). This file is
**never committed** — it's real user data (accounts, phone numbers,
emergency contacts, real emails), gitignored via
`database/seeders/data/*.sql` in `.gitignore`, generated locally and
uploaded to a real server by hand, the same way `vendor/` and `env.php` are
for InfinityFree.

**Does not load during tests** — `ReferenceDataSeeder::run()` skips it
when `APP_ENV=testing` (which `phpunit.xml` sets). `TestCase.php` uses
this seeder for every `RefreshDatabase` test, and those tests assert
specific row counts assuming just the small baseline (categories,
requirement types, one season) — loading 48 users/34 events on top of that
broke ~45 tests the first time this was tried.

## Regenerating it

```bash
mysqldump -h 127.0.0.1 -u <your-db-user> -p \
  --no-create-info \
  --complete-insert \
  --insert-ignore \
  --skip-add-locks \
  --skip-disable-keys \
  --no-tablespaces \
  --single-transaction \
  --ignore-table=<database>.personal_access_tokens \
  --ignore-table=<database>.sessions \
  --ignore-table=<database>.migrations \
  --ignore-table=<database>.cache \
  --ignore-table=<database>.cache_locks \
  <database> \
  > database/seeders/data/dev_snapshot.sql 2>/dev/null
```

**The 5 excluded tables matter, don't skip them:**
- `personal_access_tokens` — contains live, working Sanctum API tokens.
  Committing or uploading one of these means anyone with it can
  authenticate as that account. Never let this table into an export.
- `sessions` — encrypted browser session payloads, meaningless outside the
  browser that created them.
- `migrations`, `cache`, `cache_locks` — framework bookkeeping, not app
  data; already correctly populated by running migrations normally.

**`--no-create-info`** matters too — this file only INSERTs into tables
that migrations already created; it must never contain `CREATE TABLE`.

## Deploying it to InfinityFree

Upload the generated file to `htdocs/core/database/seeders/data/dev_snapshot.sql`
— same one-time manual step as `vendor/`, `storage/`, and `env.php` (see
`INFINITYFREE_DEPLOYMENT.md`). It'll be picked up automatically the next
time `/artisan-migrate?...&seed=1&class=Database\Seeders\ReferenceDataSeeder`
runs.
