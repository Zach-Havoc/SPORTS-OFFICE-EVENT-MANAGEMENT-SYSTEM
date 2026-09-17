# Event creation: time ordering + unknown venue id

## Goal

Two confirmed defects in the event write path get fixed server-side: an event can
currently be created (or updated) with an end time earlier than its start time,
and an unknown `venueId` crashes the request with a raw 500 because the FK on
`events.venue_id` rejects the write. After this change the API refuses inverted
time windows with a normal 422 validation error on both `POST /api/events` and
`PUT /api/events/{id}`, and an unknown `venueId` is treated the way the
controller already half-treats it — the venue link is dropped and the supplied
`venueName` is kept as the display label, so the request succeeds. The same
unvalidated-venue hole in `POST /api/brackets` is closed at the same time.

## What was verified in the code

- `backend/app/Http/Controllers/Api/EventController.php:68-76` — `store`
  validates `startTime`/`endTime` as `required|string` only.
- `EventController.php:82-88` resolves `$venueName` from `Venue::find()` and
  falls back to `$request->venueName`, but `EventController.php:112` writes the
  raw `$request->venueId` into `events.venue_id`.
- `backend/database/migrations/2026_09_05_000002_add_foreign_keys_where_safe.php:53-55`
  — `events.venue_id → venues.id ON DELETE SET NULL`. Same file line 144-147 adds
  `bracket_matches.venue_id → venues.id`. Tests run against MySQL
  (`backend/phpunit.xml`, `DB_CONNECTION=mysql`), so the FK is enforced in tests.
- `backend/database/migrations/2024_01_01_000001_create_sportsaxis_tables.php:86-87`
  — `start_time` / `end_time` are `string(10)`, not time/datetime columns.
- `backend/app/Models/Event.php:36-57` — `Event::timeToMinutes()` is the existing
  parser (accepts `"20:00"`, `"8:00"`, `"08:00 AM"`, `"8:00 PM"`; returns null if
  unparseable) and is what `venueConflicts()` (`Event.php:66-115`) uses.
- **`update` has both holes**: `EventController.php:128-139` validates
  `startTime`/`endTime` as `sometimes|string` and `venueId` as `sometimes|string`;
  line 176-178 writes the raw values. Confirmed in scope.
- `BracketController.php:150,153` — `startTime` is `required|string` and
  `venueId` is `sometimes|nullable|string` with no `exists`. `BracketService.php:63,146-147,203-204`
  writes that raw id into `bracket_matches.venue_id` (FK) → the same 500.
  Bracket **times** are not affected: `BracketService::endTime()` (line 452)
  derives the end from `matchDuration` (validated `min:5`), so it is always after
  the start.
- `MatchController` and `EventSessionController` do **not** write `venue_id` and
  do not accept start/end times (`EventSessionController.php:48-49` only reads
  `$event->start_time`). `TeamScheduleController` only orders by `start_time`.
  Nothing to fix in either.
- Client side: the only web caller is
  `src/app/pages/admin/EventsEnhanced.tsx:228` (`validateForm`), which already
  blocks `startTime >= endTime` for both create and edit, and requires a venue
  picked from the loaded list (`data.venueId` is required, line 230).
  `src/app/services/api.ts:275-281` are the only event write calls; the mobile app
  (`SportAxisApp/**`) has no event create/update path (grep for
  `createEvent|updateEvent` returns only `src/app/services/api.ts`,
  `src/app/hooks/api.ts`, `EventsEnhanced.tsx`).
  `src/app/services/api.ts:52-55` already flattens a Laravel `errors` object into
  the toast message, so the new 422 renders without any frontend change.

## Contract

### `POST /api/events` (admin)

Before:

- `startTime: "11:00"`, `endTime: "09:00"` → **201**, event stored inverted.
- `venueId: "does-not-exist"` → **500** (PDOException 23000, FK violation).

After:

- End time not after start time → **422**
  `{"message": "...", "errors": {"endTime": ["End time must be after start time."]}}`.
  Checked only when both values parse via `Event::timeToMinutes()`; if either is
  unparseable the check is skipped (matches today's `venueConflicts` behaviour).
- `venueId` that matches no `venues.id` → **201**, `venue_id` stored as `null`,
  `venue_name` = supplied `venueName` (existing fallback at line 88 preserved).
  Response `venueId` is therefore `null` and `venueName` is the fallback string.
- Everything else (roster rule, venue conflict 422, season/taxonomy sync)
  unchanged.

### `PUT /api/events/{id}` (admin)

Before: same two holes, un-tested.
After: same two rules. When only one of `startTime`/`endTime` is sent, the
missing side is taken from the stored event before comparing. When `venueId` is
sent and does not resolve, `venue_id` is written as `null` explicitly (it must
bypass the `array_filter(... ! is_null)` at `EventController.php:172-183`,
otherwise the stale venue silently survives the edit).

### `POST /api/brackets` (admin)

Before: `venueId: "does-not-exist"` → **500**.
After: **422** `{"errors": {"venueId": ["The selected venue id is invalid."]}}`.

Why brackets differ from events: the event payload deliberately supports a
free-text `venueName` fallback (the controller already resolves to it, and
`Event::venueConflicts()` matches on `venue_name` when there is no id), and the
existing regression test pins that behaviour — so events must accept the request.
A bracket request has no `venueName` field at all, so nullifying the id would
silently drop the venue from every generated match with no feedback; rejecting is
the honest answer there. This asymmetry is intentional and should be noted in the
code comment.

## Fix approach and why

**Defect 1 — closure rule over `Event::timeToMinutes()`, not `after:`.**

Rejected alternatives:

- `'endTime' => 'after:startTime'` — Laravel resolves this through
  `strtotime`/`Date::parse`, a *second* time parser that does not agree with
  `Event::timeToMinutes()` (the one `venueConflicts` uses). Worse, on
  `PUT /api/events/{id}` the other field is optional: when `startTime` is absent
  Laravel falls back to parsing the literal string `"startTime"` as a date and
  throws, turning a partial update into a 500 — replacing one crash with another.
- `date_format:H:i|after:startTime` — would additionally reject the `"08:00 AM"`
  form that `timeToMinutes()` accepts and that may exist in stored rows; it is a
  behaviour change beyond the defect.
- A controller-level `if` returning `{"error": "..."}` 422 (the `rosterError`
  style at `EventController.php:78-80`) — works, but validation errors are the
  shape this endpoint already uses for `schedule` and `departments`, both asserted
  with `assertJsonValidationErrors` in the existing suite, and the web client
  already flattens `errors`. Prefer the validator.

Chosen: a closure rule inside the existing `$request->validate([...])` call on
`endTime`, comparing `Event::timeToMinutes($start)` and
`Event::timeToMinutes($end)` and failing when `end <= start`. One parser, agrees
with the conflict checker by construction, correct 422 shape, and in `update` the
closure captures `$event` so it can fill in whichever side was not sent. A small
private helper on `EventController` returning the closure keeps store/update from
duplicating it; no new `App\Rules` class (none exists in the codebase today, and
one rule does not justify starting the directory).

`>=` is the comparison, i.e. a zero-length event is rejected — this matches the
UI guard (`timeToMinutes(start) >= timeToMinutes(end)`, `EventsEnhanced.tsx:228`).

**Defect 2 — write `$venue?->id`, do not add `exists:venues,id`.**

`exists:venues,id` would return 422 and is the stricter reading, but it
contradicts the regression test
`test_an_unknown_venue_id_falls_back_to_the_supplied_venue_name`, which expects
201 with `venueName: "Backup Court"` — and that expectation is right, not a
mistake in the test: the controller already contains the fallback branch
(`EventController.php:82-88`), `Event::venueConflicts()` is written to match on
`venue_name` when there is no id, and `events.venue_name` is nullable free text
precisely so an ad-hoc venue can be booked. The defect is that line 112 does not
use the resolution the controller had already performed. So: resolve the `Venue`
once, pass the resolved id (not the raw request value) to `venueConflicts()`, and
store `$venue?->id`.

## Tasks

### Task 1 — `backend-dev`: fix both defects in `EventController`

Files (exclusive): `SportAxisWeb/backend/app/Http/Controllers/Api/EventController.php`

1. Add a private helper, e.g.
   `private function endAfterStart(?string $startFallback = null): Closure`, that
   returns a closure rule using `Event::timeToMinutes()`; fail with
   `"End time must be after start time."` when both sides parse and
   `end <= start`; pass silently when either side is unparseable or missing.
2. `store` (line 68-76): attach it to `endTime`
   (`'endTime' => ['required', 'string', $this->endAfterStart()]`), reading
   `startTime` from the request.
3. `store` (line 82-88, 91-97, 112): keep the resolved `$venue` in a variable,
   pass `$venue?->id` to `Event::venueConflicts()` in place of
   `$request->venueId`, and store `'venue_id' => $venue?->id`. Leave the
   `$venueName` fallback exactly as it is.
4. `update` (line 128-139): same closure on `endTime`, with the stored
   `$event->start_time` / `$event->end_time` as the fallback for whichever side
   the request omits.
5. `update` (line 154-183): when `$request->has('venueId')`, resolve the venue
   once, use `$venue?->id` for the `venueConflicts()` call, and assign
   `$data['venue_id'] = $venue?->id` **after** the `array_filter`, so an
   unresolved id actually clears the column instead of being filtered out.

Do not touch the test files; the existing expectations are the spec.

Acceptance:
`cd SportAxisWeb/backend && php artisan test --filter=EventCreationSideEffectsTest`
is green (in particular `test_end_time_before_start_time_is_rejected` and
`test_an_unknown_venue_id_falls_back_to_the_supplied_venue_name`), and
`php artisan test --filter=EventTest` is still green (it covers the venue
double-booking and update paths and seeds `gym-1` / `pool-1` in `setUp`).

### Task 2 — `backend-dev`: reject an unknown `venueId` on bracket generation

Files (exclusive): `SportAxisWeb/backend/app/Http/Controllers/Api/BracketController.php`

Change line 153 to
`'venueId' => ['sometimes', 'nullable', 'string', 'exists:venues,id']`, with a
one-line comment stating why brackets reject where events fall back (no
`venueName` in the bracket payload). No change to `BracketService`.

Acceptance: `php artisan test --filter=BracketTest` green — existing bracket
tests call `BracketService::generate()` directly and only one passes a `venueId`,
with a real `venues` row created first (`tests/Feature/BracketTest.php:196-199`),
so nothing existing regresses.

### Task 3 — `qa-tester`: regression tests for the update path and brackets

Files (exclusive):
- `SportAxisWeb/backend/tests/Feature/EventTest.php`
- `SportAxisWeb/backend/tests/Feature/BracketTest.php`

Add (names indicative):
- `test_update_rejects_an_end_time_before_the_start_time` — PUT both times
  inverted → 422 with an `endTime` validation error.
- `test_update_rejects_an_end_time_that_lands_before_the_stored_start_time` —
  PUT only `endTime: "08:00"` against an event stored `09:00–11:00` → 422. This
  is the case a naive `after:startTime` rule would 500 on.
- `test_update_accepts_a_time_change_that_stays_ordered` — PUT only `startTime`
  → 200, guarding against the closure over-rejecting partial updates.
- `test_update_with_an_unknown_venue_id_clears_the_venue_link` — PUT
  `venueId: "does-not-exist"`, `venueName: "Backup Court"` against an event
  currently in `gym-1` → 200, `venue_id` null in the database, `venueName`
  updated (this is the `array_filter` trap from Task 1 step 5).
- In `BracketTest`: `test_generating_a_bracket_with_an_unknown_venue_is_rejected`
  — `postJson('/api/brackets', ...)` as admin with `venueId: 'does-not-exist'` →
  422 with a `venueId` validation error, and `assertDatabaseCount('brackets', 0)`.

Do **not** edit `tests/Feature/EventCreationSideEffectsTest.php` — it is the
agreed spec for this change and must pass unmodified.

Acceptance: `cd SportAxisWeb/backend && php artisan test` — the full suite green
(this is what CI runs, `.github/workflows/ci.yml:87`).

### frontend-dev — no work

`src/app/pages/admin/EventsEnhanced.tsx` already enforces the ordering rule and
requires a venue chosen from the loaded list, and `src/app/services/api.ts:52-55`
already surfaces Laravel `errors` payloads as a toast message. `src/app/services/api.ts`
and `src/app/hooks/api.ts` are **not** touched by this change: the request and
response shapes are unchanged, only the status code for previously-crashing
inputs. `SportAxisApp/**` has no event write path. No files are assigned to
`frontend-dev`; if a later step turns out to need one, it goes through the
planner, not a direct edit.

## Sequencing

- Task 1 and Task 2 are both `backend-dev` and touch disjoint files, so they can
  be done in either order in the same pass. They do **not** touch
  `backend/routes/api.php` (no route, method or middleware changes), so there is
  no contention there.
- Task 3 runs **after** Tasks 1 and 2. `qa-tester` never runs alongside the devs,
  and its new tests assert the post-fix behaviour, so running it first would just
  produce red.
- No migrations are added, so no hand-numbered migration slot needs claiming
  (`database/migrations/` is untouched).

## Risks and open questions

- **Unparseable times remain accepted.** The chosen closure skips its check when
  `Event::timeToMinutes()` returns null, so `startTime: "banana"` still stores.
  That is today's behaviour (`venueConflicts` also silently skips such rows) and
  tightening it — e.g. a shared `time` format rule — is a separate change with a
  wider blast radius (stored `"08:00 AM"`-style values, the bracket payload,
  seeders). Flagged, not fixed here. Say so if you want it folded in.
- **Existing inverted or dangling rows are not cleaned up.** The fix is
  validation-only; any event already stored with `end <= start`, or with a
  `venue_id` that no longer resolves, stays as it is. No backfill is planned
  because the FK would have prevented dangling ids from ever being written in the
  first place — this is an assumption based on the FK migration being in place
  since 2026-09-05, not on a query against production data.
- **`venueName` is not required when `venueId` misses.** After Task 1, a request
  with a bogus `venueId` and no `venueName` yields an event with no venue at all,
  200/201 and silent. That is the status quo intent of the fallback branch, but if
  the product rule is "an event must have a venue" (the admin UI enforces it,
  `EventsEnhanced.tsx:230`), the server should require `venueName` when `venueId`
  does not resolve. Recommended reading: leave it as-is for this fix, since the
  regression test only pins the fallback case; raise it separately.
- **Bracket asymmetry is a judgement call.** Rejecting on brackets while
  accepting on events is deliberate (argued above), but it is the one decision
  here that is not forced by an existing test. If you would rather brackets also
  degrade silently (`venue_id` null), that is a one-line change in
  `BracketService::generate` instead — say so before Task 2 starts.
- Tests were not executed while planning (the suite needs the `sportsaxis_test`
  MySQL database); the failing-test statuses quoted are from the QA pass, not
  re-confirmed here.
