# SportsAxis — Hosting the API on Render

InfinityFree answers every non-browser request with a JavaScript "browser
check" page, so the mobile app can't talk to the API there. This moves the
**Laravel API** to Render, where both the mobile app and the web app can use it.
The web frontend can stay on InfinityFree — browsers don't care where the API
lives.

```
Mobile app ─┐
            ├──►  Render: sportsaxis-api (Docker, Laravel)  ──►  MySQL (Aiven)
Web app  ───┘                     │
(InfinityFree)                    ├──►  Uploads bucket (S3-compatible)
                                  └──►  OCR service (unchanged)
```

Everything is free-tier. Allow about an hour the first time.

---

## Free-tier limits to know before a demo

| Limit | What it means | What to do |
|---|---|---|
| The service sleeps after 15 min idle | The first request after a nap takes ~30–60 s | Open `https://<your-service>.onrender.com/up` in a browser a minute before you present |
| The disk is wiped on every restart/deploy | Uploaded PDFs/images would vanish | Uploads go to a bucket (Step 2) |
| No MySQL on Render | — | Use Aiven's free MySQL (Step 1) |
| No websockets/cron | Live scores poll every 60 s (same as InfinityFree); the daily backup doesn't run | Nothing |

---

## Step 1 — MySQL database (Aiven, free)

1. Sign up at <https://aiven.io> → **Create service** → **MySQL** → plan **Free**.
   Pick a region near Singapore.
2. When it's running, open the service's **Overview** and note
   **Host, Port, User, Password, Database name** (`defaultdb`).
3. Click **Download** next to **CA certificate** and keep `ca.pem`.
4. **Advanced configuration** → add `mysql.sql_require_primary_key` → set it to
   **off** → Save. Aiven turns it on by default, and some of Laravel's own tables
   are created before their primary key is added, so migrations fail without
   this change.

## Step 2 — Uploads bucket (S3-compatible)

Any S3-compatible bucket works. **Supabase Storage** is free and needs no card:

1. <https://supabase.com> → new project → **Storage** → **New bucket** named
   `sportsaxis`, and tick **Public bucket**.
2. **Project Settings → Storage → S3 Connection**: note the **Endpoint** and
   **Region**, then **New access key** and note the key ID and secret.
3. The public URL prefix is
   `https://<project-ref>.supabase.co/storage/v1/object/public/sportsaxis`.

(Cloudflare R2 or Backblaze B2 work the same way. To skip the bucket, set
`PUBLIC_DISK_DRIVER=local`, but then uploads disappear on every restart.)

## Step 3 — Create the Render service

1. Push this repo to GitHub (`render.yaml` sits at the repo root).
2. <https://render.com> → **New → Blueprint** → pick the repo. Render reads
   `render.yaml` and asks for every value marked `sync: false`:

| Key | Value |
|---|---|
| `APP_KEY` | run `php artisan key:generate --show` in `SportAxisWeb/backend`, paste the whole `base64:…` string |
| `APP_URL` | `https://sportsaxis-api.onrender.com` (the service's URL, no trailing slash — fix it after the first deploy if Render gives a different one) |
| `CORS_ALLOWED_ORIGINS` | `https://sportsaxis-bsuarasof.freedev.app,http://localhost:5173` |
| `DB_HOST` / `DB_PORT` / `DB_DATABASE` / `DB_USERNAME` / `DB_PASSWORD` | from Step 1 |
| `DB_SSL_CA_PEM` | the full text of `ca.pem`, from `-----BEGIN CERTIFICATE-----` through `-----END CERTIFICATE-----` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | from Step 2 |
| `AWS_DEFAULT_REGION` / `AWS_ENDPOINT` | from Step 2 |
| `AWS_BUCKET` | `sportsaxis` |
| `AWS_URL` | the public URL prefix from Step 2 |
| `MAIL_USERNAME` / `MAIL_PASSWORD` / `MAIL_FROM_ADDRESS` | the same Gmail + app password you use on InfinityFree |
| `OCR_SERVICE_URL` / `OCR_API_KEY` | the same values you use on InfinityFree |
| `MIGRATION_TOKEN` | any long random string (it guards `/artisan-migrate`) |

3. **Apply**. The first build takes ~5–10 minutes. On boot the container runs
   `php artisan migrate --force`, so the tables are created automatically.

## Step 4 — Seed the accounts

The new database is empty. Create the four test accounts (plus the season and
the default CMO requirement types) once, in a browser:

```
https://sportsaxis-api.onrender.com/artisan-migrate?token=<MIGRATION_TOKEN>&seed=1&class=CleanSlateSeeder
```

Then check `https://sportsaxis-api.onrender.com/up` (should say the app is up)
and `https://sportsaxis-api.onrender.com/api/events` (should return JSON).

## Step 5 — Point the mobile app at it

In `SportAxisApp/`:

```bash
npm run start:prod     # uses https://sportsaxis-api.onrender.com/api
npm run start:local    # uses your laptop's backend at http://<LAN IP>:8000/api
```

`start:local` works out your laptop's current Wi-Fi IP on its own, so you
don't have to edit `.env` when you change networks. Run the backend with
`php artisan serve --host=0.0.0.0 --port=8000` so the phone can reach it.
If Render gives your service a different URL, change `PROD_API_URL` in
`SportAxisApp/scripts/start-with-api.js`.

For an EAS build (a real APK), set the variable once:

```bash
eas env:create --name EXPO_PUBLIC_API_URL --environment preview \
  --value https://sportsaxis-api.onrender.com/api --visibility plaintext
```

## Step 6 — Point the web app at it (so both share one database)

Until you do this, the website still uses the InfinityFree database and the
app uses the Render one: **two separate sets of data**.

1. GitHub repo → **Settings → Secrets and variables → Actions** → edit
   `VITE_API_URL` → `https://sportsaxis-api.onrender.com/api`.
2. Re-run the **Deploy to InfinityFree** workflow (or push to `main`).

The site keeps being served from InfinityFree; only its API calls go to Render.

---

## Everyday

- **Deploys:** pushing changes under `SportAxisWeb/backend/` to `main`
  redeploys automatically, and migrations run on boot.
- **Logs:** Render dashboard → service → **Logs**.
- **Full reset:** `/artisan-migrate?token=…&fresh=1&seed=1&class=CleanSlateSeeder`.
