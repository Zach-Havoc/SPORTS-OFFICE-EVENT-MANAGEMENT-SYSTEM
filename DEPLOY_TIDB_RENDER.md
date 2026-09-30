# Deploying SportsAxis: database on TiDB Cloud, website and API on Render

Three pieces, all on free plans:

| Piece | Where | Address (example) |
|---|---|---|
| Database (MySQL-compatible) | TiDB Cloud Starter | `gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000` |
| API (Laravel, `SportAxisWeb/backend`) | Render web service (Docker) | `https://sportsaxis-api.onrender.com` |
| Website (React, `SportAxisWeb`) | Render static site | `https://sportsaxis-web.onrender.com` |

The mobile app talks to the Render API, which, unlike InfinityFree, answers apps
as well as browsers. Everything Render needs is already in the repo: `render.yaml`
(the Blueprint), `SportAxisWeb/backend/Dockerfile` and `docker/entrypoint.sh`.

Keep both clouds in **Singapore** so the API and database are close together.

---

## 0. Before you start

- Push the latest `main` to GitHub. Render deploys from the repo.
- Make accounts at **tidbcloud.com**, **render.com** (sign in with GitHub) and, for
  the phone app, **expo.dev**.
- Have these ready:
  - an app key, from `cd SportAxisWeb/backend && php artisan key:generate --show`
    (copy the whole `base64:…` line)
  - a maintenance token, from `openssl rand -hex 32`

---

## 1. TiDB Cloud: the database

1. **Create a cluster.** TiDB Cloud → *Create Cluster* → **Starter** (the free
   plan) → cloud **AWS**, region **Singapore (ap-southeast-1)** → name it
   `sportsaxis` → *Create*.
2. **Get the connection details.** Open the cluster → *Connect*:
   - Connection type: **Public**
   - Click **Generate Password** and copy it now; it's shown only once.
   - Note the **Host** (`gateway01.ap-southeast-1.prod.aws.tidbcloud.com`),
     **Port** (`4000`) and **User** (looks like `4Xy2abc9.root`).
3. **Create the database.** Open *SQL Editor* in the cluster and run:
   ```sql
   CREATE DATABASE sportsaxis;
   ```
4. Leave it empty. The API creates the tables itself the first time it starts
   (step 2), and on TiDB it sets two tables up so that plays keep their order.
   See *Moving existing data* below if you want to bring your local data.

> TiDB Cloud requires an encrypted (TLS) connection. The API handles that
> automatically; there's no certificate to download or paste.

---

## 2. Render: the API and the website

1. Render dashboard → **New → Blueprint** → pick this GitHub repo → Render reads
   `render.yaml` and shows two services, **sportsaxis-api** and **sportsaxis-web**.
2. Fill in the values it asks for:

   **sportsaxis-api**

   | Key | Value |
   |---|---|
   | `APP_KEY` | the `base64:…` key from step 0 |
   | `APP_URL` | `https://sportsaxis-api.onrender.com` |
   | `FRONTEND_URL` | `https://sportsaxis-web.onrender.com` |
   | `CORS_ALLOWED_ORIGINS` | `https://sportsaxis-web.onrender.com` (add `,http://localhost:5173` to also allow your local website) |
   | `DB_HOST` | the TiDB host |
   | `DB_USERNAME` | the TiDB user (`….root`) |
   | `DB_PASSWORD` | the TiDB password |
   | `MIGRATION_TOKEN` | the token from step 0 |
   | `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS` | the Gmail account and its App Password (the same ones as your local `.env`) |
   | `OCR_SERVICE_URL`, `OCR_API_KEY` | where your OCR service runs (leave blank if it isn't hosted; scanning just won't work) |
   | `AWS_…` | leave blank for now (see *Uploaded files* below) |

   **sportsaxis-web**

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://sportsaxis-api.onrender.com/api` |

   `DB_PORT` (4000) and `DB_DATABASE` (`sportsaxis`) are already set in the Blueprint.

   > If Render says a name is taken, it gives the service a different address
   > (e.g. `sportsaxis-api-x1y2.onrender.com`). Use the real addresses in
   > `APP_URL`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS` and `VITE_API_URL`.

3. Click **Apply**. The first deploy takes about 5–10 minutes. The API builds its
   Docker image, starts, and runs the migrations against TiDB. In the API's
   **Logs** you should see the migrations listed, then Apache starting.
4. Check it's alive:
   - `https://sportsaxis-api.onrender.com/up` shows a green "Application up" page
   - `https://sportsaxis-api.onrender.com/api/departments` shows `[]` (empty for now)

---

## 3. First admin account

The new database has no users. Open this once in a browser, with your token:

```
https://sportsaxis-api.onrender.com/artisan-migrate?token=<MIGRATION_TOKEN>&seed=1&class=CleanSlateSeeder
```

It creates the starting accounts: `admin@university.edu` / `admin123`, plus a
test coach, athlete and judge. Then:

1. Open `https://sportsaxis-web.onrender.com`, sign in as the admin, and
   **change the password straight away** (Settings → Account).
2. Add the colleges, sports and so on, or load the demo:

**Demo data (optional).** In Render → sportsaxis-api → *Environment*, set
`ALLOW_DEMO_RESET` to `true` and save (the service restarts). Then in the website:
**Settings → System → Reset & Load Demo Data**. It keeps your admin, takes a
backup first, and on Render's small free server can take a few minutes. Set
`ALLOW_DEMO_RESET` back to `false` afterwards.

---

## 4. The mobile app

The `production-apk` build profile in `SportAxisApp/eas.json` points the app at
`https://sportsaxis-api.onrender.com/api`. Change it there if your API address is
different. Then:

```
cd SportAxisApp
npm install -g eas-cli     # once
eas login                  # once
eas build -p android --profile production-apk
```

When the build finishes (10–20 min), open the link on the phone and install the
`.apk`. The app now works on any network: Wi-Fi or mobile data.

To try the app against the live API without building, run
`npm run start:prod` (or `npm run start:local` for your computer's API).

---

## Things to know about the free plans

- **The API sleeps after 15 minutes of no use.** The next visit wakes it up,
  which takes about a minute, so the first page or app screen will be slow.
  Before an event, open the website a few minutes early to wake it.
- **Uploaded files are wiped on every deploy or restart.** This covers
  requirement PDFs, college logos and homepage slides, because Render's free disk
  isn't permanent. To keep them, make a free **Cloudflare R2** bucket, set
  `PUBLIC_DISK_DRIVER=s3` and fill in the `AWS_*` values (R2 → *Manage API tokens*
  gives the key, secret and endpoint; make the bucket public and put its public
  address in `AWS_URL`).
- **No daily database backup runs** (there's no cron on the free plan). TiDB
  Cloud keeps its own automatic backups; you can also export from its console.
- **Live scores refresh every few seconds** instead of instantly (no websocket
  server on the free plan). This is the same as the InfinityFree site.
- **OCR** (PaddleOCR) needs more memory than Render's free plan gives, so it
  runs on your laptop through an ngrok tunnel (`OCR/README.md`). Point
  `OCR_SERVICE_URL` at it, or leave scanning off.
- **TiDB Cloud Starter** gives 5 GB of storage and a monthly allowance of
  request units. That's far more than an intramurals season needs.

---

## Moving existing data (optional)

To bring your local database instead of starting fresh, **let the API create the
tables first** (steps 1–2), then load only the rows:

```
mysqldump -u <local user> -p --no-create-info --skip-triggers --complete-insert sportsaxis \
  --ignore-table=sportsaxis.migrations > data.sql
mysql -h <TiDB host> -P 4000 -u <TiDB user> -p --ssl-mode=VERIFY_IDENTITY \
  --ssl-ca=/etc/ssl/certs/ca-certificates.crt sportsaxis < data.sql
```

Don't import a full dump with its `CREATE TABLE` statements. That would undo the
ordered-ID setup the API gives TiDB's `game_events` and `audit_logs` tables, and
volleyball and basketball replays depend on it.

---

## If something goes wrong

| What you see | Likely cause |
|---|---|
| API logs: `SQLSTATE[HY000] [1045] Access denied` | `DB_USERNAME` must include its prefix (`xxxx.root`); regenerate the password in TiDB if unsure. |
| API logs: `SSL connection is required` / certificate errors | `MYSQL_ATTR_SSL_CA` was overridden. Remove it from the environment so the system certificates are used. |
| API logs: `Unknown database 'sportsaxis'` | Step 1.3: create the database in TiDB's SQL Editor. |
| Website loads but every request fails with a CORS error | `CORS_ALLOWED_ORIGINS` must match the website's address exactly (https, no trailing slash). |
| Website shows old data or the wrong API | `VITE_API_URL` is baked in at build time: change it, then *Manual Deploy* the website. |
| App says it can't connect | The API may be asleep (wait a minute and retry), or the app was built with a different API address. |
