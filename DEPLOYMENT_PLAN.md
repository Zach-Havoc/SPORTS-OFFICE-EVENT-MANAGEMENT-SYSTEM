# SportsAxis — Deployment Plan

Tracks what's actually done vs. still pending across all three deployable
parts of this system. For *how* each step works, see
`INFINITYFREE_DEPLOYMENT.md` (web) and `OCR/README.md` (OCR service) —
this file is the checklist, not the explanation.

---

## Scope — where each part deploys

| Part | Target | Status |
| :--- | :--- | :--- |
| `SportAxisWeb/` (frontend + backend) | **InfinityFree**, one domain, split layout | CI/CD built, not yet live |
| `SportAxisApp/` (mobile) | **EAS build** → APK / app stores | `eas.json` configured, not yet built for release |
| `OCR/` (PaddleOCR service) | **Separate host** (Oracle Always Free / Cloud Run / Render) | Docker-ready, host not yet chosen (Oracle signup blocked on card decline) |

`SportAxisWeb`'s GitHub Actions workflow (`deploy-web-infinityfree.yml`) is
scoped to `SportAxisWeb/**` only — it never triggers on or touches
`SportAxisApp/` or `OCR/`. Those two deploy through entirely separate
mechanisms (`eas build`, and whatever the OCR host ends up being).

---

## Part A — Web (frontend + backend → InfinityFree)

### Already done
- [x] Frontend builds and code-splits correctly (`npm run build`)
- [x] Backend split-layout architecture built: `public/index.php` front
      controller, `.htaccess` routing (including the `/storage/*` alias),
      `core/.htaccess` lockdown, `env.php.example`
- [x] `/artisan-migrate` endpoint (migrate/seed/fresh/storage-link via URL,
      token-protected) — tested live, works correctly
- [x] GitHub Actions workflow builds both halves and FTP-deploys them,
      excluding `vendor/`, `storage/`, and env files from automation
- [x] `composer install --no-dev` verified to succeed cleanly

### Still pending (all one-time, manual, on InfinityFree)
- [ ] Create the GitHub repository secrets: `FTP_SERVER`, `FTP_USERNAME`,
      `FTP_PASSWORD`, `VITE_API_URL`
- [ ] Create the MySQL database in InfinityFree's vPanel; note host/db
      name/username/password
- [ ] Build `vendor/` locally (`composer install --no-dev --optimize-autoloader`)
      and upload it to `htdocs/core/vendor/`
- [ ] Upload the `storage/` skeleton (from the repo, including
      `storage/app/public/.htaccess`) to `htdocs/core/storage/`
- [ ] Copy `env.php.example` → fill in real values (APP_KEY, DB creds,
      MIGRATION_TOKEN, CORS_ALLOWED_ORIGINS) → upload as `htdocs/core/env.php`
- [ ] Trigger the first deploy (push to `main`, or run the workflow manually)
- [ ] Run `/artisan-migrate?token=...` to create the database schema
- [ ] Visit the live domain and confirm the SPA loads, login works, and a
      `/storage/*` asset (e.g. a department logo) actually resolves

---

## Part B — Mobile app (→ EAS)

### Already done
- [x] `eas.json` configured with development/preview/production profiles,
      each wired to a named EAS environment
- [x] Android package id set (`com.zachhavoc.SportAxisApp`), EAS project linked

### Still pending
- [ ] Set `EXPO_PUBLIC_API_URL` per environment: `eas env:create --name
      EXPO_PUBLIC_API_URL --environment preview|production --value ...`
      (needs Part A's real domain first)
- [ ] `eas build --platform android --profile preview` — first real build
- [ ] (Later, for a store release) add `ios.bundleIdentifier` to `app.json`
      if an iOS build is wanted

---

## Part C — OCR service (→ its own host)

### Already done
- [x] `service.py` hardened for internet exposure (`OCR_API_KEY` header
      check, configurable bind host) — tested live
- [x] `Dockerfile` + `.dockerignore` written (not yet build-tested — no
      Docker available in this environment)
- [x] Laravel side wired: `OCR_SERVICE_URL`/`OCR_API_KEY` config +
      `OcrController` sends the auth header when configured
- [x] `paddleocr.service` systemd unit written for the non-Docker path

### Still pending
- [ ] Resolve Oracle Cloud signup (card declining) — or fall back to
      Cloud Run/Render if it doesn't resolve
- [ ] Provision the actual VM/container
- [ ] Deploy the service (systemd or Docker path, both documented in
      `OCR/README.md`) and confirm `/health` + a real `/extract` call work
      from outside the host
- [ ] Set `OCR_SERVICE_URL`/`OCR_API_KEY` in the backend's `env.php` (Part A)
      once this exists

---

## Suggested order

Nothing here is strictly blocking except: **Part B's production
`EXPO_PUBLIC_API_URL`** and **Part C's `OCR_SERVICE_URL`** both need Part
A's real domain to exist first. Everything else can happen in any order —
in practice, finishing Part A first (it's the most complete) unblocks the
other two.
