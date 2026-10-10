# Selenium test automation

These tests open Chrome on your screen and use SportAxis by themselves, the way a person would: they visit pages, sign in through the login form, click the sidebar, open forms and type in search boxes. Each run:

1. **creates temporary test accounts**: an admin, a committee member, a coach, and three athletes on that coach's roster. They all use `@e2e.sportaxis.test` addresses and a fresh random password;
2. **runs every test** with those accounts;
3. **deletes the accounts again**, together with their roster rows, sign-in tokens, notifications and audit entries. This happens even when tests fail.

The tests run **only on your own machine**. They refuse any site that isn't `localhost`, and the account command refuses to run when `APP_ENV` is `production`.

| Suite | What it checks | Command |
|---|---|---|
| PHPUnit (`backend/tests`) | API rules and database | `php artisan test` |
| Vitest (`src/**/*.test.tsx`) | Single components in a simulated browser | `npm test` |
| **Selenium (`e2e/selenium`)** | **Whole pages in a real browser, on the running site** | `npm run test:e2e` |

## Running

With the local site running (`composer dev` from `SportAxisWeb/backend`, which serves the API on :8000 and the website on :5173), go to `SportAxisWeb` and run:

```bash
npm run test:e2e            # Chrome opens and the tests run in it
npm run test:e2e:headless   # same, without a window
npm run test:e2e:cleanup    # delete leftover test accounts (e.g. after Ctrl+C)
```

To follow along more slowly, add a pause after each page: `E2E_SLOW_MS=800 npm run test:e2e`. To run only some tests, use `--grep`: `npm run test:e2e -- --grep "Coach"`.

The tests use your development database, so it needs data (events, brackets, colleges). The demo data from `php artisan sportaxis:reset-demo` works. The test accounts are separate from your own accounts and from the demo accounts, and nothing else in the database is changed.

You don't need to install Chrome yourself. Selenium Manager downloads a matching Chrome and chromedriver on the first run, which takes about a minute, and caches them in `~/.cache/selenium`.

When a test fails, a screenshot of the page is saved to `e2e/selenium/artifacts/`. That folder is not committed.

### With a throwaway database

```bash
npm run test:e2e:auto
```

This runs [`run.sh`](run.sh), which takes about 3 minutes and leaves even your development database alone:

1. It creates a separate database, `sportaxis_e2e`, then migrates it and loads demo data. It refuses to run against any database whose name doesn't contain `e2e` or `test`, and it checks that the app really sees the scratch database before wiping anything.
2. It starts a test API on port 8001. Mail goes to the log, the queue runs inline and broadcasting is off.
3. It builds the website in its own `e2e` mode, pointing only at that API, and serves it on port 4173.
4. It runs the page tests, then the whole-system test below (temporary accounts included), then shuts everything down.

| Option | Use |
|---|---|
| `E2E_SKIP_RESET=1` | Reuse the last run's data (faster) |
| `E2E_SERVE_ONLY=1` | Start the throwaway site and keep it up, to look at a failure by hand |

## The whole system, end to end

`flows/system.flow.mjs` runs one season the way it really happens, in 49 steps. Each step is done by the role that does it, and records are created for real:

| # | Part | What happens |
|---|---|---|
| 1 | The office sets up | Generates coach, committee and athlete registration codes. Imports the registrar's student list (CSV). Adds a sport, a venue and the next season. |
| 2 | Sign-ups | A coach, a committee member and an athlete sign up with those codes; the athlete is checked against the student list. A used code is refused. |
| 3 | The team forms | The office assigns the coach a college. The coach picks a sport and is refused one the college already has a coach for. The athlete joins with the team code. The coach adds and edits an athlete by hand. |
| 4 | Tryouts | The coach posts a tryout. A student applies from the public page, with email verification. The coach accepts them onto the roster. |
| 5 | CMO requirements | The athlete uploads every required document (PDF). The coach approves them and forwards the athlete; the office accepts. The batch shows in Transactions, and the coach is notified. |
| 6 | A game | The office creates a game in four parts and assigns the committee member. It shows on their panel. It is scored live and finalised through the mobile app's API, appears on the live board, is made official in Reports and shows in the history. |
| 7 | Coaching | The coach records a performance and takes attendance; the athlete sees both. |
| 8 | An appeal | The coach files an appeal (PDF). The office asks the other college for a counter, that college's coach files it (PDF), and the office decides. The coach sees the decision. |
| 9 | Brackets | A round-robin bracket for the new sport is generated, published, and opened from the public page. |
| 10–12 | The rest | A slideshow slide (image upload). Disabling and re-enabling an account. Changing a name and password. Forgot password. Deleting a game and restoring it from the recycle bin. Exporting standings as CSV. |

It creates records, so it runs **only on the throwaway database** (`npm run test:e2e:auto`, where mail goes to the log) and refuses any other database. The accounts it signs up use `@e2e.sportaxis.test` and are deleted at the end, along with the scores, appeals and attendance they made. Everything else (the game, venue, bracket and so on) stays in `sportaxis_e2e` for you to inspect until the next run rebuilds it.

The mobile app itself can't be driven by Selenium. The committee's scoring is done through the same API the app calls, and the result is checked on the website.

Run only one of the two suites with `E2E_ONLY=pages` or `E2E_ONLY=flow`.

## Settings

| Variable | Default | Use |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:5173` | The local site to test (localhost only) |
| `E2E_HEADLESS` | window shown | `1` hides the browser |
| `E2E_SLOW_MS` | `0` | Pause after each page, in milliseconds |
| `CHROME_BIN` | Chrome found or downloaded by Selenium Manager | Path to a specific Chrome |
| `E2E_WAIT_MS` | `15000` | How long to wait for an element |

## What is covered

There are 91 checks in total. They open every page of every role and try the main actions on each page that don't save anything.

| Spec | Covers |
|---|---|
| `public.e2e.mjs` | Every public page loads with no script errors: schedule, live, leaderboard, brackets, announcements, history, the TV standings board, the privacy notice and the 404 page. Opening a bracket from the list. The announcement department and sport filters and search. |
| `auth.e2e.mjs` | A wrong password is refused. The admin signs in and lands on the dashboard. Sign out works from the account menu. |
| `access.e2e.mjs` | A visitor who isn't signed in is sent to sign in. Coaches and athletes are kept out of admin pages, and stay signed in. |
| `admin.e2e.mjs` | All 15 sidebar pages. Dashboard figures and charts, notifications, Ctrl+K search. Events: counts, search, sport filter, the New Event form, grid and list views. Venue schedules, seasons, bracket formats, user search, coaches, the CMO tabs, transaction filters, registration codes, appeals, reports, history, recovery and audit, site content tabs, every Settings section, and account settings. |
| `coach.e2e.mjs` | All 12 coach pages. Opening an athlete and each tab of their record. The edit page and Cancel. The add form refusing an empty athlete. The schedule, the performance and announcement forms, attendance, tryout tabs, CMO forwarding, the appeal form, the line-up, and every sidebar link. |
| `athlete.e2e.mjs` | All 7 athlete pages, including their key sections, and every sidebar link. |
| `judge.e2e.mjs` | The committee panel (assigned games, or the "none assigned" message) and account settings. |

## How it fits together

- `support/accounts.mjs` creates the accounts before the first test and deletes them after the last. Mocha runs it as a global fixture, set in `.mocharc.json`. It calls `php artisan sportaxis:e2e-accounts create|delete` (`backend/app/Console/Commands/E2eAccounts.php`).
- `support/driver.mjs` holds the shared helpers: starting Chrome, signing in, waiting for headings and text, dialogs, dropdowns, and failure screenshots.
- `specs/*.e2e.mjs` are the tests, one file per area. Each file gets its own browser.

## Rules for new tests

- **Read and navigate only.** Don't create events, protests or CMO returns. The queue worker emails real people, and a test should leave the database as it found it. The test accounts are the only exception, and they are removed automatically.
- **Sign in with `login(driver, role)`** (`admin`, `coach`, `athlete` or `judge`), once per spec file. The server allows only 5 login attempts per minute per account.
- **Wait, don't sleep.** Use `expectHeading`, `findText`, `find` and `waitForPath`. Pages load lazily, so whatever you read right after a click may still be the previous page.
