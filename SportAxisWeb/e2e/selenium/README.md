# Selenium end-to-end tests

These tests drive a real Chrome through the SportAxis website, the same way a person would: they open pages, sign in through the login form, click the sidebar and type in search boxes. They complement the other suites:

| Suite | What it checks | Command |
|---|---|---|
| PHPUnit (`backend/tests`) | API rules and database | `php artisan test` |
| Vitest (`src/**/*.test.tsx`) | Single components in a simulated browser | `npm test` |
| **Selenium (`e2e/selenium`)** | **Whole pages in a real browser, against the running site** | `npm run test:e2e` |

## Running

1. Start the site locally from `SportAxisWeb/backend` with `composer dev`. That serves the API on :8000 and the web app on :5173.
2. Make sure the demo data is loaded (`php artisan sportaxis:reset-demo`). The tests sign in with the demo accounts, whose password is `demo123`.
3. From `SportAxisWeb`, run:

```bash
npm run test:e2e          # headless
npm run test:e2e:headed   # opens Chrome so you can watch
```

You don't need to install Chrome yourself. Selenium Manager downloads a matching Chrome and chromedriver on the first run, which takes about a minute, and caches them in `~/.cache/selenium`.

When a test fails, a screenshot of the page is saved to `e2e/selenium/artifacts/`. That folder is not committed.

## Automated runs

You can run the whole suite with no setup, against a throwaway copy of the system:

```bash
npm run test:e2e:auto
```

This runs [`run.sh`](run.sh), which takes about 3 minutes:

1. It creates its own database, `sportaxis_e2e`, then migrates and seeds it and loads the demo data. It refuses to run against any database whose name doesn't contain `e2e` or `test`. It also checks that the app really sees the scratch database before wiping anything.
2. It starts a throwaway API on port 8001. Mail goes to the log, the queue runs inline and broadcasting is off, so nobody is emailed.
3. It builds the website in its own `e2e` mode, pointing only at that API, and serves it on port 4173. It never uses `.env.production` or Render. It stops if the build points anywhere remote.
4. It runs all the specs, then shuts everything down.

Your normal `composer dev` setup and your real database are left alone, and both can keep running at the same time. On a fresh database the admin password is `admin123`; every other account uses `demo123`.

Options for the automated run:

```bash
E2E_SKIP_RESET=1 npm run test:e2e:auto        # reuse the last run's data (faster)
E2E_SERVE_ONLY=1 npm run test:e2e:auto        # start the throwaway site and keep it up, to look at a failure by hand
npm run test:e2e:auto -- --grep "Coach"       # only some tests
```

### On GitHub

[`.github/workflows/e2e.yml`](../../../.github/workflows/e2e.yml) runs the same script on GitHub Actions on every push and pull request to `main`. You can also start it by hand from the Actions tab ("Run workflow"). It uses a MySQL service container, so the deployed TiDB and Render are never touched. If a test fails, the screenshots and server logs are attached to the run as `e2e-artifacts`.

## Settings

All settings are environment variables:

| Variable | Default | Use |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:5173` | Site to test, e.g. the deployed Render site |
| `E2E_HEADLESS` | headless | `0` shows the browser |
| `CHROME_BIN` | Chrome found or downloaded by Selenium Manager | Path to a specific Chrome |
| `E2E_ADMIN_EMAIL`, `E2E_COACH_EMAIL`, `E2E_ATHLETE_EMAIL`, `E2E_JUDGE_EMAIL` | demo accounts | Accounts to sign in with |
| `E2E_PASSWORD` (or `E2E_<ROLE>_PASSWORD`) | `demo123` | Their password |
| `E2E_WAIT_MS` | `15000` | How long to wait for an element |

For example:

```bash
E2E_BASE_URL=https://your-site.onrender.com E2E_PASSWORD=... npm run test:e2e
```

## What is covered

91 checks in total. They open every page of every role, plus the main actions on each page that don't save anything.

| Spec | Covers |
|---|---|
| `public.e2e.mjs` | Every public page loads with no script errors: schedule, live, leaderboard, brackets, announcements, history, the TV standings board, the privacy notice and the 404 page. Opening a bracket from the list. The announcement department and sport filters and search. |
| `auth.e2e.mjs` | A wrong password is refused. The admin signs in and lands on the dashboard. Sign out works from the account menu. |
| `access.e2e.mjs` | A visitor who isn't signed in is sent to sign in. Coaches and athletes are kept out of admin pages. |
| `admin.e2e.mjs` | All 15 sidebar pages. Dashboard figures and charts, notifications, Ctrl+K search. Events: counts, search, sport filter, the New Event form, grid and list views. Venue schedules, seasons, bracket formats, user search, coaches, the CMO tabs, transaction filters, registration codes, appeals, reports, history, recovery and audit, site content tabs, every Settings section, and account settings. |
| `coach.e2e.mjs` | All 12 coach pages. Opening an athlete and each tab of their record. The edit page and Cancel. The add form refusing an empty athlete. The schedule, the performance and announcement forms, attendance, tryout tabs, CMO forwarding, the appeal form, the line-up, and every sidebar link. |
| `athlete.e2e.mjs` | All 7 athlete pages, including their key sections, and every sidebar link. |
| `judge.e2e.mjs` | The committee panel lists its games, and account settings. |

## Rules for new tests

- **Read and navigate only.** Don't create events, protests or CMO returns. The queue worker emails real people, and a test should leave the database as it found it.
- **Sign in once per spec file.** `useBrowser()` gives each file its own browser, and the server allows only 5 login attempts per minute per account.
- **Wait, don't sleep.** Use `expectHeading`, `findText`, `find` and `waitForPath` from `support/driver.mjs`. Pages load lazily, so whatever you read right after a click may still be the previous page.
