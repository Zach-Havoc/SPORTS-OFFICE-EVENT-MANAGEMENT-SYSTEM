# Settings for the throwaway SportAxis the Selenium tests run against.
# Sourced by run.sh; you can also source it in a terminal to run the
# full-system test by hand against a site started with E2E_SERVE_ONLY=1:
#
#   source e2e/selenium/env.sh && npx mocha --config e2e/selenium/.mocharc.flow.json
#
# shellcheck shell=bash
_E2E_HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$_E2E_HERE/../../backend" && pwd)"

say() { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }
fail() { printf '\n\033[31m✖ %s\033[0m\n' "$*" >&2; return 1 2>/dev/null || exit 1; }

E2E_DB="${E2E_DB:-sportaxis_e2e}"
API_PORT="${E2E_API_PORT:-8001}"
WEB_PORT="${E2E_WEB_PORT:-4173}"
API_URL="http://127.0.0.1:$API_PORT"
WEB_URL="http://localhost:$WEB_PORT"

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

# What the tests themselves read.
export E2E_BASE_URL="$WEB_URL"
export E2E_API_URL="$API_URL/api"
# The full-system test creates records, so it only runs here (E2E_WRITES).
export E2E_WRITES=1
