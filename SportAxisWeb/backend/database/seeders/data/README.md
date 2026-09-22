# dev_snapshot.php — real data, committed to git

`ReferenceDataSeeder::seedLocalSnapshot()` loads this file if it exists and
inserts every row via `DB::table($table)->insertOrIgnore($rows)`.

**This is committed to git and contains real user data** — names, phone
numbers, emergency contacts, real emails. That's a deliberate, explicit
choice (not the default recommendation — a gitignored version was offered
first and turned down), so if this repo or its history is ever made public
or shared more broadly, that data goes with it. Worth remembering if the
repo's visibility ever changes.

**Does not load during tests** — `ReferenceDataSeeder::run()` skips it when
`APP_ENV=testing` (set in `phpunit.xml`). `TestCase.php` uses this seeder
for every `RefreshDatabase` test, and those tests assert specific row
counts assuming just the small baseline (categories, requirement types,
one season) — loading 48 users/34 events on top of that broke ~45 tests
the first time this was tried.

## What's excluded, and why — never add these back

- **`personal_access_tokens`** — contains live, working Sanctum API
  tokens. Including one means anyone who can read this file (which is
  now anyone with repo access, since it's committed) can authenticate as
  that account.
- **`sessions`** — encrypted browser session payloads, meaningless outside
  the browser that created them.
- **`migrations`, `cache`, `cache_locks`** — framework bookkeeping, not
  app data; already correctly populated by running migrations normally.

## Regenerating it

Run this against your local database (adjust host/user/password/db name):

```php
<?php
$pdo = new PDO('mysql:host=127.0.0.1;dbname=sportsaxis;charset=utf8mb4', 'DB_USER', 'DB_PASSWORD');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$tables = [
    'departments', 'venues', 'categories', 'seasons', 'users', 'requirement_types',
    'athletes', 'discipline_entries', 'coach_category', 'events', 'event_department',
    'brackets', 'bracket_matches', 'live_scores', 'scores', 'rankings',
    'team_matches', 'performance_records', 'requirements', 'attendance_sessions',
    'attendance_records', 'audit_logs', 'notifications', 'announcements',
    'tryout_applications', 'registration_codes', 'site_slides', 'email_verifications',
    'protests',
]; // NOT personal_access_tokens or sessions — see above.

$out = "<?php\n\nreturn [\n";
foreach ($tables as $table) {
    $rows = $pdo->query("SELECT * FROM `{$table}`")->fetchAll(PDO::FETCH_ASSOC);
    $out .= "    '{$table}' => " . var_export($rows, true) . ",\n";
}
$out .= "];\n";

file_put_contents(__DIR__ . '/dev_snapshot.php', $out);
```

Then `php -l database/seeders/data/dev_snapshot.php` to confirm it's valid,
and re-run the test suite before committing — a schema change (new/renamed
column) since this was last generated could otherwise silently produce
rows that don't match the current migrations.

## Load order (why this file loads *before* the baseline methods)

`ReferenceDataSeeder::run()` calls `seedLocalSnapshot()` before
`seedRacquetDisciplines()`/`seedDefaultRequirementTypes()`/`seedDefaultSeason()`,
not after. This file carries its own specific UUIDs for
categories/requirement_types/seasons, cross-referenced by its own
events/discipline_entries/etc. Those three methods each check-before-insert
and correctly skip once they see this data already exists — but only if it
loads first. Loading it last would instead race them: their fresh random
UUIDs would claim the same `categories.name` unique slot first, silently
blocking this file's own category rows via `insertOrIgnore` and leaving its
events pointing at category_ids that were never created.
