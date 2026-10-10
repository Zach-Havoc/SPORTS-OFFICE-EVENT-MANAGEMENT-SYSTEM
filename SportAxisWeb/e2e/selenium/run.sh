#!/usr/bin/env bash
#
# Automated Selenium run: builds a throwaway copy of SportAxis, fills it with
# demo data, serves it, runs the whole suite, then shuts everything down.
# Local only: run it on your own machine with `npm run test:e2e:auto`.
#
# It never touches your real database or your inboxes:
#   - the API runs against its own database (E2E_DB, default sportaxis_e2e),
#     and refuses to start if the app would see any other database;
#   - mail is written to the log, the queue runs inline, broadcasting is off;
#   - the website is built in its own "e2e" mode into e2e/selenium/.site,
#     pointing only at this local API (never .env.production / Render).
#
# Settings (environment variables, all optional):
#   E2E_DB          database to create and fill   (default sportaxis_e2e)
#   E2E_API_PORT    port for the throwaway API     (default 8001)
#   E2E_WEB_PORT    port for the throwaway website (default 4173)
#   E2E_SKIP_RESET  1 = reuse the data from the last run (faster re-runs)
#   E2E_SERVE_ONLY  1 = start the site and keep it up (no tests), to look
#                   at a failure by hand; Ctrl+C stops it
#   DB_HOST / DB_PORT / DB_USERNAME / DB_PASSWORD  MySQL server
#                   (default: the values in backend/.env)
# Anything else (E2E_HEADLESS=0, CHROME_BIN, ...) is passed on to the suite;
# extra arguments are passed to mocha, e.g. `run.sh --grep Admin`.
set -euo pipefail

WEB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API_DIR="$WEB_DIR/backend"
SITE_DIR="$WEB_DIR/e2e/selenium/.site"
LOG_DIR="$WEB_DIR/e2e/selenium/artifacts"
mkdir -p "$LOG_DIR"

E2E_DB="${E2E_DB:-sportaxis_e2e}"
API_PORT="${E2E_API_PORT:-8001}"
WEB_PORT="${E2E_WEB_PORT:-4173}"
API_URL="http://127.0.0.1:$API_PORT"
WEB_URL="http://localhost:$WEB_PORT"

say() { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }
fail() { printf '\n\033[31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

# A reset wipes the database, so only ever run against a scratch one.
[[ "$E2E_DB" == *e2e* || "$E2E_DB" == *test* ]] \
  || fail "E2E_DB must contain 'e2e' or 'test' (got '$E2E_DB'); the run wipes it."

# MySQL credentials: the environment wins, else backend/.env.
from_env_file() { grep -E "^$1=" "$API_DIR/.env" 2>/dev/null | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
export DB_CONNECTION=mysql
export DB_HOST="${DB_HOST:-$(from_env_file DB_HOST)}"
export DB_PORT="${DB_PORT:-$(from_env_file DB_PORT)}"
export DB_USERNAME="${DB_USERNAME:-$(from_env_file DB_USERNAME)}"
export DB_PASSWORD="${DB_PASSWORD:-$(from_env_file DB_PASSWORD)}"
export DB_DATABASE="$E2E_DB"

# Keep the throwaway app self-contained: no mail out, no workers, no sockets.
export APP_ENV=e2e APP_DEBUG=false APP_URL="$API_URL"
export MAIL_MAILER=log QUEUE_CONNECTION=sync BROADCAST_CONNECTION=log
export CACHE_STORE=file SESSION_DRIVER=file
export ALLOW_DEMO_RESET=true
export CORS_ALLOWED_ORIGINS="$WEB_URL,http://127.0.0.1:$WEB_PORT"

PIDS=()
cleanup() {
  for pid in "${PIDS[@]:-}"; do [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait_for() { # url, name
  for _ in $(seq 1 60); do
    curl -fsS -o /dev/null "$1" 2>/dev/null && return 0
    sleep 1
  done
  fail "$2 did not come up at $1 (see $LOG_DIR)"
}

cd "$API_DIR"
[[ -f .env ]] || { cp .env.example .env; php artisan key:generate --force >/dev/null; }

# A cached config would ignore every override above, so make sure the app
# really sees the scratch database before anything is wiped.
SEEN_DB="$(php artisan tinker --execute 'echo config("database.connections.mysql.database");' 2>/dev/null | tail -1)"
[[ "$SEEN_DB" == "$E2E_DB" ]] \
  || fail "The app would use database '$SEEN_DB', not '$E2E_DB'. Run 'php artisan config:clear' and try again."

if [[ "${E2E_SKIP_RESET:-0}" != "1" ]]; then
  say "Database $E2E_DB: create, migrate, seed demo data"
  MYSQL_PWD="$DB_PASSWORD" mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USERNAME" \
    -e "CREATE DATABASE IF NOT EXISTS \`$E2E_DB\`"
  php artisan migrate:fresh --force >/dev/null
  php artisan db:seed --force >/dev/null
  RESET_OUT="$(php artisan sportaxis:reset-demo --force)"
  echo "$RESET_OUT" | grep -E "^Done in" || true
  # The reset backs up the scratch database first; that copy isn't needed.
  BACKUP="$(echo "$RESET_OUT" | sed -n 's/^Backup: *//p')"
  [[ -n "$BACKUP" && -f "$BACKUP" ]] && rm -f "$BACKUP"
fi

say "API on $API_URL"
# Not `artisan serve`: it drops variables that aren't in .env, which would
# quietly point the API back at the real database.
# Laravel's router script expects to be started from public/.
(cd public && PHP_CLI_SERVER_WORKERS=4 exec php -S "127.0.0.1:$API_PORT" \
  ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php) \
  >"$LOG_DIR/api.log" 2>&1 &
PIDS+=($!)
wait_for "$API_URL/api/events?perPage=1" "The API"

say "Website on $WEB_URL"
cd "$WEB_DIR"
VITE_API_URL="$API_URL/api" VITE_REVERB_APP_KEY="" \
  npx vite build --mode e2e --outDir "$SITE_DIR" --emptyOutDir --logLevel warn
# The build must talk to this API only — never production.
if grep -rqE "onrender\.com|https://[a-z0-9.-]+/api" "$SITE_DIR/assets"; then
  fail "The built site points at a remote API; refusing to test against it."
fi
npx vite preview --mode e2e --outDir "$SITE_DIR" --port "$WEB_PORT" --strictPort \
  >"$LOG_DIR/web.log" 2>&1 &
PIDS+=($!)
wait_for "$WEB_URL/" "The website"

if [[ "${E2E_SERVE_ONLY:-0}" == "1" ]]; then
  say "Serving $WEB_URL (API $API_URL). Demo accounts: admin@university.edu / admin123, others demo123. Ctrl+C to stop."
  wait
  exit 0
fi

say "Selenium suite"
# The suite makes its own temporary accounts in this database and deletes
# them at the end (support/accounts.mjs).
E2E_BASE_URL="$WEB_URL" npx mocha --config e2e/selenium/.mocharc.json "$@"
