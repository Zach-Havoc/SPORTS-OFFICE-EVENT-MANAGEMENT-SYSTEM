/**
 * Temporary test accounts, made before the suite and removed after it.
 *
 * Mocha runs `mochaGlobalSetup` once before any test and
 * `mochaGlobalTeardown` once after the last, whether tests passed or not
 * (see .mocharc.json). Both shell out to the backend's
 * `php artisan sportaxis:e2e-accounts`, so the accounts go into the same
 * database the local API is using. An interrupted run is cleaned up at the
 * start of the next one, or by hand with `npm run test:e2e:cleanup`.
 *
 * Local only: the suite refuses to run against anything but this machine.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const API_DIR = path.resolve(here, '../../../backend');
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';

/** Filled in by the setup: { admin, coach, athlete, judge } → { email, password, name }. */
export const ACCOUNTS = {};

function artisan(action) {
  const out = execFileSync('php', ['artisan', 'sportaxis:e2e-accounts', action], {
    cwd: API_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return JSON.parse(out.trim().split('\n').pop());
}

export function assertLocal() {
  const host = new URL(BASE_URL).hostname;
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
    throw new Error(`The Selenium suite only runs against this machine (localhost); E2E_BASE_URL is ${BASE_URL}.`);
  }
}

export async function mochaGlobalSetup() {
  assertLocal();
  const { password, accounts } = artisan('create');
  for (const [role, acct] of Object.entries(accounts)) {
    ACCOUNTS[role] = { ...acct, password };
  }
  console.log(`  Test accounts created: ${Object.values(ACCOUNTS).map((a) => a.email).join(', ')}`);
}

export async function mochaGlobalTeardown() {
  const { deleted } = artisan('delete');
  console.log(`  Test accounts deleted: ${deleted.users ?? 0} accounts, ${deleted.roster ?? 0} roster rows, ${deleted.tokens ?? 0} sign-in tokens.`);
}

// `node e2e/selenium/support/accounts.mjs delete` — clean up by hand.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const action = process.argv[2];
  if (action !== 'delete') {
    console.error('Usage: node e2e/selenium/support/accounts.mjs delete');
    process.exit(1);
  }
  console.log(JSON.stringify(artisan('delete')));
}
