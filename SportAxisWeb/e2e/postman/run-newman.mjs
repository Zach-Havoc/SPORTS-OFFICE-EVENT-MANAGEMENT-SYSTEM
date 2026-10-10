/**
 * Runs the Postman collection with Newman against the local throwaway API.
 *
 *   npm run test:api            (starts the throwaway site itself, via run.sh)
 *
 * Makes the temporary test accounts, writes them into a Postman environment,
 * runs SportAxis-API.postman_collection.json and saves three reports to
 * e2e/selenium/artifacts/postman/: the console summary, a JSON result file
 * and an HTML report. The accounts are deleted afterwards, pass or fail.
 * Only against this machine and the throwaway database: the run creates
 * games, scores and appeals.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import newman from 'newman';
import { ACCOUNTS, mochaGlobalSetup as createAccounts, mochaGlobalTeardown as deleteAccounts } from '../selenium/support/accounts.mjs';
import { API_URL, databaseName } from '../selenium/support/backend.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../selenium/artifacts/postman');

if (!['localhost', '127.0.0.1'].includes(new URL(API_URL).hostname)) throw new Error(`Local API only (got ${API_URL}).`);
if (process.env.E2E_WRITES !== '1' || !/e2e|test/.test(databaseName())) {
  throw new Error('The API tests create records; run them with `npm run test:api` (throwaway database).');
}

fs.mkdirSync(OUT, { recursive: true });
await createAccounts();
const env = {
  name: 'SportAxis local (throwaway)',
  values: [
    { key: 'baseUrl', value: API_URL, enabled: true },
    { key: 'password', value: ACCOUNTS.admin.password, enabled: true },
    ...['admin', 'coach', 'athlete', 'judge'].map((r) => ({ key: `${r}Email`, value: ACCOUNTS[r].email, enabled: true })),
  ],
};

let failures = 0;
try {
  const summary = await new Promise((resolve, reject) =>
    newman.run(
      {
        collection: JSON.parse(fs.readFileSync(path.join(here, 'SportAxis-API.postman_collection.json'), 'utf8')),
        environment: env,
        workingDir: path.resolve(here, '..'),
        reporters: ['cli', 'json', 'htmlextra'],
        reporter: {
          json: { export: path.join(OUT, 'newman-results.json') },
          htmlextra: { export: path.join(OUT, 'newman-report.html'), title: 'SportAxis API tests (Postman / Newman)', browserTitle: 'SportAxis API tests' },
        },
        timeoutRequest: 30000,
      },
      (err, s) => (err ? reject(err) : resolve(s)),
    ),
  );
  failures = summary.run.failures.length;
} finally {
  await deleteAccounts();
}
console.log(`\nReports: ${path.relative(process.cwd(), OUT)}/ (newman-report.html, newman-results.json)`);
process.exit(failures ? 1 : 0);
