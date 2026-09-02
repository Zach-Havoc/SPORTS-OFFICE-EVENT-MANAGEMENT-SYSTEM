# Bracketing

How tournament brackets are generated, published, and progressed in SportAxis.

---

## 1. Concepts

| Term | Meaning |
|---|---|
| **Bracket** | A persisted tournament tree for one sport. Has a `format`, a `status`, and a list of matches. |
| **Bracket match** | One node in the tree. Knows its round/slot, the two teams (or `TBD`), which child matches feed it, which parent slot it feeds, and the scheduled **Event** it is played as. |
| **Event** | The existing schedulable/scoreable entity. Every playable bracket match is backed by one Event — that's what judges score in the mobile app. |
| **Progression** | When a match's result is in, its winner is written into the next round's match (and that match's Event), automatically. |
| **Seed** | A team's rank in the sport's standings (wins → point differential → points → head‑to‑head). Used to place teams so the strongest meet last. |

A bracket is **the tree**; Events are **the games on the calendar**; `team_matches` / `rankings` are **the factual results**. Progression is the glue that reads a result and moves the tree forward.

---

## 2. Lifecycle

```
draft ──publish──► active ──(final match advanced)──► completed
```

| Status | Meaning |
|---|---|
| `draft` | Tree built and saved. **No Events yet.** Nothing on the calendar. |
| `active` | Every match has an Event. Round 1 is `scheduled`; later rounds wait for their teams. |
| `completed` | The final has been decided. `bracket.champion` is set. |

Match status:

| Status | Meaning |
|---|---|
| `pending` | At least one team still unknown (`TBD`). |
| `ready` | Both teams known, no Event yet (only before publish). |
| `scheduled` | Both teams known **and** an Event exists — playable. |
| `completed` | Result recorded; winner has been fed forward. |
| *(bye)* | `is_bye = true` — one team only; auto‑completed at generation, no Event. |

---

## 3. Generating a bracket

**Admin → Bracketing.** Pick a **sport**, **format**, **participants** (departments), a **start date/time**, **match duration**, and a **venue** (or "Auto"). "Generate Bracket" shows a local preview; **"Save & Publish"** persists it and creates the Events.

Generation is done **server‑side** (`BracketService::generate`) so the saved bracket is authoritative — the on‑screen preview is only illustrative.

### Single elimination

- `rounds = ceil(log2(N))`, bracket `size = 2^rounds`.
- **Seeded** (checkbox "Seed from standings"): teams are ranked by the sport's standings, then placed in the standard serpentine slot order so #1 meets the lowest seed first and #1/#2 can only meet in the final:
  - size 4 → slot order `[1, 4, 2, 3]`
  - size 8 → `[1, 8, 4, 5, 2, 7, 3, 6]`
- **Unseeded**: the admin's selection order is used as the seed order. Slotting is still serpentine — this only skips the standings sort.
- Teams are **always** placed in serpentine slot order (seeded or not), so byes fall against the top slots and `BYE vs BYE` can never occur for any team count.
- **Byes** (`size − N` of them) sit against the top seeds. A `Team vs BYE` match is created with `is_bye = true`, immediately marked `completed`, and its lone team is walked straight into the next round. `BYE vs BYE` never happens (`ceil(log2 N)` guarantees `size < 2N`).
- Each match is wired: `next_match_id` + `next_match_slot` (parent), and for round > 1 `home_source_match_id` / `away_source_match_id` (children).
- Match times are laid out from the start time, `matchDuration + breakDuration` apart, with a 30‑minute gap between rounds. Each match also stores its planned `venue_id` / `venue_name`.

### Round robin

- Every pair plays once. Matches are spread across days: when the running clock passes 18:00 it rolls to the next day at the start time and the round number increments.
- All teams are known up front, so there is **no tree and no progression** — round robin is a flat list of `ready` matches. (Its results feed **standings**, which then seed an elimination bracket.)

---

## 4. Publishing

`POST /brackets/{id}/publish` (or the **Publish** button on the bracket page).

For every non‑bye match it creates an **Event** (`category` = sport, the match's date/time/venue, `departments` = the two teams or `[]` while `TBD`, a single "Overall Performance / 100" criterion, status `upcoming`) and stores `bracket_match.event_id`.

**Venue conflicts are checked first.** If any match's slot overlaps an existing Event in the same venue, publish is **rejected** with the list of conflicts and **nothing is created** — the bracket stays `draft`. Fix the venue/time and publish again. (Same rule as manual event creation — see `Event::venueConflicts`.)

All rounds' Events are created at publish time so the schedule and venue grid are complete from day one; later rounds' Event names/departments are backfilled as teams advance.

---

## 5. Progression — advancing a winner

`POST /brackets/{id}/matches/{matchId}/advance`

Triggered from the bracket page per match. Three ways to decide the winner:

1. **Use result** — no `winner` in the request. The server reads the match's Event:
   - a completed `team_matches` row for that `event_id` → its `winner`, else
   - the top `rankings` row for that event (needs ≥ 2 departments scored).
   - If neither is final → **422**, "No final result for this match yet." (Score it in the mobile app first, or use *Pick*.)
2. **Pick** (`{ "winner": "<department>" }`) — admin override / forfeit / walkover.
3. Byes are advanced automatically at generation — you never advance them by hand.

On advance the service records the `winner` on that one match, then calls
**`resolve(bracket)`** which rebuilds the whole tree from the set of matches
that currently have a winner:

1. Clear every derived team slot (round > 1); settle byes.
2. Round by round, ascending: mark each match `completed` if both its teams
   are known and its winner is one of them (else clear it back to
   `scheduled` / `ready` / `pending`); then push its winner (or loser, where a
   node's `*_source_outcome` says so — reserved for a 3rd‑place match) into the
   parent slot named by `home_source_match_id` / `away_source_match_id`.
3. Save every match, refresh each backing Event's `name` + `departments`
   (`"Basketball (Finals): CICS vs CET"`), and set `bracket.champion` /
   `bracket.status` from the root match.

Because the tree is recomputed wholesale, there is no fragile unwinding — see
the next section.

### Correcting a result

`advance` with `{ "winner": "...", "force": true }` (the **"change result"** link
on a completed match). Only the flag differs — it lets you overwrite an already
decided match. `resolve` then re‑derives everything downstream: the old winner
is dropped from every later slot, any later match that had been played on a
now‑invalid team is re‑opened, later Events are renamed, and the champion is
recomputed (the bracket returns to `active` if the final is no longer settled).

---

## 6. Deleting

`DELETE /brackets/{id}` removes the bracket and its matches. Add `?withEvents=1` to also delete the scheduled Events it created (the **Delete** button does this).

---

## 7. API reference

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /api/brackets?sport=` | public | List brackets (id, name, status, champion, match count). |
| `GET /api/brackets/{id}` | public | Full tree — `matches[]` with teams, sources, status, event id, schedule. |
| `POST /api/brackets` | admin | Generate + persist. Body: `sport`, `format` (`single_elimination`\|`round_robin`), `participants[]`, `seedFromStandings?`, `startDate`, `startTime`, `matchDuration?`, `breakDuration?`, `venueId?`. Returns the tree (`status: draft`). |
| `POST /api/brackets/{id}/publish` | admin | Create the Events. `422 { error, conflicts[] }` on a venue clash (nothing created). |
| `POST /api/brackets/{id}/matches/{matchId}/advance` | admin | Record a winner. Body: `winner?`, `force?`. `422` if no result and no `winner`. |
| `DELETE /api/brackets/{id}?withEvents=1` | admin | Delete bracket (+ optionally its Events). |

All admin routes are `auth:sanctum` + `role:admin`; the two `GET`s are public for the read‑only tree view.

---

## 8. Data model

### `brackets`
`id` · `sport` · `format` (`single_elimination` \| `round_robin`) · `name` · `status` (`draft` \| `active` \| `completed`) · `seeded` · `champion` (dept, nullable) · `settings` json (`startDate`, `startTime`, `matchDuration`, `breakDuration`, `venueId`) · `created_by` · timestamps

### `bracket_matches`
`id` · `bracket_id` · `round` (1‑based) · `slot` (0‑based) · `stage_label` ("Round 1", "Quarter‑Finals", "Semi‑Finals", "Finals", "3rd Place")
`home_team` / `away_team` (dept, null = TBD)
`home_source_match_id` / `away_source_match_id` · `home_source_outcome` / `away_source_outcome` (`winner` \| `loser`)
`next_match_id` · `next_match_slot` (`home` \| `away`)
`scheduled_date` · `scheduled_time` · `venue_id` · `venue_name` — the planned slot; the Event is source of truth once published
`event_id` · `winner` · `loser` · `is_bye` · `status` (`pending` \| `ready` \| `scheduled` \| `completed`)

Standings used for seeding come from `TeamMatch::standings($sport)` (extracted from `MatchController`), which reads completed `team_matches`.

---

## 9. Code map

| File | Role |
|---|---|
| `backend/app/Services/BracketService.php` | Generation, seeding, byes, publish, `advance`, and `resolve` (whole‑tree recompute). The engine. |
| `backend/app/Http/Controllers/Api/BracketController.php` | Thin HTTP layer over the service. |
| `backend/app/Models/Bracket.php`, `BracketMatch.php` | Models + `toApiFormat()`. |
| `backend/app/Models/TeamMatch.php` | `standings()` — the seeding source. |
| `backend/app/Models/Event.php` | `venueConflicts()` — reused by publish. |
| `backend/tests/Feature/BracketTest.php` | Tree shape, byes, seeding, publish, conflict block, propagation, champion, forfeits, guards. |
| `src/app/pages/admin/Bracketing.tsx` | Config + preview + "Save & Publish" + saved‑brackets list. |
| `src/app/pages/admin/BracketDetail.tsx` | Admin bracket page: connected tree (click a match to manage), champion banner, publish (drafts), delete. Round‑robin falls back to a column list. |
| `src/app/components/BracketTree.tsx` | The connected single‑elim tree (`@g-loot/react-tournament-brackets`) with zoom + fullscreen; used by the admin and public pages. |
| `src/app/pages/public/Brackets.tsx`, `Bracket.tsx` | Public `/brackets` list + `/bracket/:id` read‑only tree. |
| `src/app/services/api.ts`, `src/app/hooks/api.ts` | `getBrackets` / `getBracket` / `createBracket` / `publishBracket` / `advanceBracketMatch` / `deleteBracket` + hooks. |
| `src/app/utils/bracket.ts` | Seed‑slot math (mirrored in `BracketService::seedSlots`). |

---

## 10. Typical run

1. Round‑robin group stage played → results recorded (mobile app) → **standings** populate.
2. Admin → Bracketing → sport, **single elimination**, tick **Seed from standings**, pick participants, set date/time/venue → **Save & Publish**.
3. Lands on the bracket page: round 1 is `scheduled` with Events on the calendar; later rounds are `TBD`.
4. Each game is played and scored in the mobile app. Admin opens the bracket, hits **Use result** on the finished match → the winner drops into the next round and its Event is renamed.
5. Forfeit / no‑show → **Pick** the winner instead.
6. Wrong result recorded → **change result** on the completed match; downstream is recomputed.
7. Final advanced → **Champion** banner; bracket `completed`.

---

## 11. Not yet built (roadmap)

- **Auto‑advance** — advance automatically when a linked Event's result finalises (config‑gated), instead of the admin clicking *Use result*.
- **3rd‑place match** — the plumbing (`*_source_outcome = loser`) exists; the generator doesn't emit the node yet.
- **Round‑robin → playoff bridge** — one action to seed an elimination bracket from final RR standings.
- **Finals formats** — twice‑to‑beat, best‑of‑3, stepladder (via a series id + games‑to‑win on the match).
