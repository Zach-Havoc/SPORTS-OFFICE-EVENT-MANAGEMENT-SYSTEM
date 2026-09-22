# SportsAxis — InfinityFree CI/CD Deployment Guide

Deploys **both** the React/Vite web frontend and the Laravel backend to a
**single** InfinityFree domain, via GitHub Actions. One shared front
controller at the web root decides, per request, whether to hand off to
Laravel (`/api/*`, `/sanctum/*`) or serve the SPA shell (everything else).

---

## Why this needs more than a normal Laravel deploy

InfinityFree is shared PHP hosting: no SSH, no persistent processes, no
custom document root, no `composer`/`php artisan` on the server itself.
That rules a few things out permanently, regardless of how the files are
laid out:

- **Reverb** (WebSocket live scores) — no persistent socket server allowed.
  Degrades to the app's existing 60s polling fallback — not broken, just
  not truly live. Leave `BROADCAST_CONNECTION=log` in `env.php`.
- **A real queue worker** — no persistent process. Set
  `QUEUE_CONNECTION=sync` so jobs run inline instead of piling up unprocessed.
- **The scheduled daily backup** (`routes/console.php`'s
  `Schedule::command('backup:database')`) — needs `schedule:run` firing
  every minute via cron, which InfinityFree's free tier doesn't reliably
  offer. It simply won't run here; back up the database another way if you
  need it (e.g. periodically hitting `/artisan-migrate` isn't a substitute
  for this — that endpoint doesn't run scheduled commands).
- **The PaddleOCR Python service** — no Python at all. Runs on its own host
  entirely (Oracle/Cloud Run/Render — see `OCR/README.md`), which the
  Laravel backend calls over HTTP via `OCR_SERVICE_URL`.
- **Composer** — can't run on the server. `vendor/` is built in CI but
  deliberately excluded from the automated deploy; it's uploaded to the
  server by hand, once (see Step 3).
- **`proc_open`** — disabled (confirmed empirically, see
  `backend/docs/SCHEMA.md`'s InfinityFree section). This mostly doesn't
  matter since nothing in this app calls it directly, except Laravel's own
  `schema:dump` fast-install path does, to shell out to the `mysql` CLI —
  worked around by excluding `database/schema/mysql-schema.sql` from this
  deploy specifically, so migrations fall back to normal per-file replay
  here (still the fast dump-loading path everywhere else).

Migrations are the one exception that *does* work despite no CLI access —
`Artisan::call('migrate', ...)` is just PHP application code running inside
a normal HTTP request, no shell needed (as long as it doesn't itself try to
shell out — see the `proc_open` note above). That's what `/artisan-migrate`
(Step 6) is for.

---

## Architecture

**A note on InfinityFree's folder layout, since this tripped us up once:**
some accounts nest each domain's web root under a domain-named folder
(`Home/<domain>/htdocs/`) instead of a flat `Home/htdocs/` — this happens
when one account manages multiple domains. The *current* hosting slot for
`sportsaxis-bsuarasof.freedev.app` is flat (confirmed via File Manager:
`htdocs/` sits directly at Home), so `deploy-web-infinityfree.yml` targets
plain `htdocs/` and `htdocs/core/`. **If this project ever moves to a
different domain or slot, check File Manager first** — don't assume either
layout; verify it, since guessing wrong means files upload successfully
while the live site still 404s.

```
htdocs/                              <- InfinityFree public web root
├── index.php                        <- ONE front controller for everything
│                                        (SportAxisWeb/public/index.php)
├── .htaccess                        <- routes requests to index.php,
│                                        including a /storage/* -> core/storage
│                                        alias (see that file's comments)
├── assets/, index.html, ...         <- the Vite build output (SportAxisWeb/dist/)
└── core/                            <- the Laravel app (SportAxisWeb/backend/)
    ├── app/, config/, database/, routes/, bootstrap/
    ├── .htaccess                    <- denies ALL direct access to this folder
    ├── storage/
    │   └── app/public/.htaccess     <- the one exception: allows the
    │                                    /storage/* alias above to work
    ├── vendor/                      <- uploaded once by hand, never by CI
    └── env.php                      <- created once by hand, never by CI
```

`core/` sits inside the public web root (InfinityFree gives no other
option), so `core/.htaccess` denies direct access to everything in it —
without that, `https://yourdomain/core/app/Models/User.php` would be
directly reachable over HTTP.

---

## Before you start

- Your InfinityFree FTP details (Client Area → FTP Details): server,
  username, password.
- Your domain (e.g. `sportsaxis-bsuarasof.freedev.app`).
- Push access to this repo on GitHub.
- `SportAxisWeb/backend/` runnable locally — needed to generate `vendor/`
  and `APP_KEY` in Step 3.
- FileZilla or the InfinityFree File Manager, for the one-time manual
  uploads in Step 3.

---

## 🔑 Step 1: GitHub Repository Secrets

Settings → Secrets and variables → Actions, on
`Zach-Havoc/SPORTS-OFFICE-EVENT-MANAGEMENT-SYSTEM`:

| Secret | Value |
| :--- | :--- |
| `FTP_SERVER` | `ftpupload.net` |
| `FTP_USERNAME` | `if0_42946688` |
| `FTP_PASSWORD` | your InfinityFree password |
| `VITE_API_URL` | `https://<your-domain>/api` — **same domain as the site itself**, since backend and frontend now share one domain |
| `VITE_REVERB_APP_KEY`/`HOST`/`PORT`/`SCHEME` | leave unset (Reverb doesn't run here — see above) |

---

## 📋 Step 2: Set up MySQL on InfinityFree

vPanel → MySQL Databases → create a database. Note the host, database name,
username, password shown there — they go into `env.php` in Step 4.

---

## 📁 Step 3: One-time manual uploads (never touched by CI, on purpose)

Three things need to exist on the server *before* the first automated
deploy, and CI is deliberately configured to never overwrite them (see the
`exclude:` lists in `.github/workflows/deploy-web-infinityfree.yml`):

1. **`vendor/`** — run `composer install --no-dev --optimize-autoloader` on
   your own machine inside `SportAxisWeb/backend/`, then upload the
   resulting `vendor/` folder via FTP/File Manager to `htdocs/core/vendor/`.
2. **The `storage/` skeleton** — upload `SportAxisWeb/backend/storage/` (as
   it exists in the repo — mostly empty framework/cache, framework/sessions,
   framework/views, logs, app/public folders) to `htdocs/core/storage/`,
   **including** `storage/app/public/.htaccess`. This is what's excluded
   from every automated deploy afterward, so real uploaded files (score-sheet
   photos, department logos, etc.) never get wiped by a routine deploy.
3. **`env.php`** — copy `SportAxisWeb/backend/env.php.example`, fill in the
   real values (APP_KEY, DB credentials from Step 2, MIGRATION_TOKEN, your
   web app's domain for CORS_ALLOWED_ORIGINS, OCR_SERVICE_URL once that's
   hosted), upload it to `htdocs/core/env.php`.

Generate `APP_KEY` locally: `cd SportAxisWeb/backend && php artisan key:generate --show`.

---

## 🚀 Step 4: Deploy

Push to `main` (touching `SportAxisWeb/`) or trigger manually from the
Actions tab → **Deploy to InfinityFree** → **Run workflow**. Every run:

1. Builds `vendor/` in CI (to catch dependency errors early — the result is
   discarded, never uploaded, since the real one is the manual upload above).
2. Builds the Vite frontend with the `VITE_*` secrets injected.
3. FTP-syncs the backend (minus `vendor/`, `storage/`, `public/`, tests,
   `.env*`) to `htdocs/core/`.
4. FTP-syncs the frontend build to `htdocs/`.

---

## ⚡ Step 5: Run migrations

Since there's no CLI access, `GET /artisan-migrate` runs Artisan commands
via a normal HTTP request (`app/Http/Controllers/MaintenanceController.php`).
Token-protected — set `MIGRATION_TOKEN` in `env.php` first (`openssl rand
-hex 32`).

```
# Run pending migrations
https://<your-domain>/artisan-migrate?token=<TOKEN>

# Migrate + seed
https://<your-domain>/artisan-migrate?token=<TOKEN>&seed=1

# Wipe + fresh migrate + seed everything
https://<your-domain>/artisan-migrate?token=<TOKEN>&fresh=1&seed=1

# Seed one specific seeder class only
https://<your-domain>/artisan-migrate?token=<TOKEN>&seed=1&class=DepartmentSeeder
```

Always clears config/route/view caches at the end (even after a failure in
an earlier step, so nothing stale is left to debug separately). A bad
`class=` name or a failed migration shows up as a clear `FAILED: ...` line
in the response instead of crashing to a generic error page.

---

## ✅ Step 6: Verify it's actually working

- Visit the domain — the app shell should load.
- Hit an inner route directly (e.g. `.../leaderboard`) — should load the
  page, not 404 (confirms the SPA routing through `index.php` works).
- Log in or hit any page that calls the API — confirms the `/api` branch is
  reaching Laravel.
- Confirm a page with an uploaded image (department logo, site slide)
  actually shows it — confirms the `/storage/*` alias is working.

If something fails, check in this order: the GitHub Actions log → whether
`env.php` actually made it to `core/env.php` with correct values → the
InfinityFree error log (vPanel, if available).

---

## 🔒 Security notes

- `env.php` and `vendor/` live only on the server and in `.gitignore` —
  never commit a filled-in `env.php` (`env.php.example` is the only version
  that belongs in git).
- `core/.htaccess` blocks all direct access to the backend folder; only the
  one `storage/app/public/.htaccess` exception exists, and only for that
  one path.
- If the FTP password or any secret is ever pasted in plain text somewhere
  outside GitHub Secrets, rotate it from the InfinityFree vPanel.
- Rotate `MIGRATION_TOKEN` if it's ever exposed the same way — anyone with
  it can run `migrate:fresh` (full data wipe) via a GET request.
