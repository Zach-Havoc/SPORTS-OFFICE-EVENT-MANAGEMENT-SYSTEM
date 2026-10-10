/**
 * Runs the Apache JMeter load test against the local throwaway API.
 *
 *   npm run test:load        (starts the throwaway site itself, via run.sh)
 *
 * Prepares what the operations need (temporary accounts and their tokens, a
 * game with a committee member, a training session), then runs
 * sportaxis-load.jmx once per concurrency level (E2E_LOAD_USERS, default
 * 10,25,50,100 users) and sportaxis-ocr.jmx at E2E_OCR_USERS (default 1,2,4).
 * Results go to e2e/selenium/artifacts/jmeter/: raw .jtl files, JMeter's
 * HTML dashboard for the highest level, and summary.json / summary.csv with
 * per-operation response times, throughput and error rate.
 *
 * JMeter and Java are looked up in JMETER_HOME and JMETER_JAVA_HOME (default:
 * ~/.local/share/sportaxis-tools/, else JAVA_HOME; see README.md).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACCOUNTS, mochaGlobalSetup as createAccounts, mochaGlobalTeardown as deleteAccounts } from '../selenium/support/accounts.mjs';
import { API_URL, api, apiToken, databaseName, query } from '../selenium/support/backend.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../selenium/artifacts/jmeter');
const TOOLS = path.join(os.homedir(), '.local/share/sportaxis-tools');
const JMETER = path.join(process.env.JMETER_HOME || path.join(TOOLS, 'apache-jmeter-5.6.3'), 'bin', 'jmeter');
// The bundled JRE wins over a JAVA_HOME left behind by other tools (e.g. Android Studio).
const JAVA_HOME = process.env.JMETER_JAVA_HOME || [path.join(TOOLS, 'jre'), process.env.JAVA_HOME].find((d) => d && fs.existsSync(path.join(d, 'bin', 'java')));
const LEVELS = (process.env.E2E_LOAD_USERS || '10,25,50,100').split(',').map(Number);
const OCR_LEVELS = (process.env.E2E_OCR_USERS || '1,2,4').split(',').map(Number);
const DURATION = Number(process.env.E2E_LOAD_DURATION || 45);
const SHEET = path.resolve(here, '../ocr-accuracy/out/sheets/06-general.jpg');
const CAS = 'College of Arts and Sciences';
const CICS = 'College of Informatics and Computing Sciences';
// OCR extraction keeps each uploaded photo; the folder is shared with the dev setup.
const CAPTURES = path.resolve(here, '../../backend/storage/app/public/ocr_captures');
const capturesBefore = new Set(fs.existsSync(CAPTURES) ? fs.readdirSync(CAPTURES) : []);

const url = new URL(API_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error(`Local API only (got ${API_URL}).`);
if (process.env.E2E_WRITES !== '1' || !/e2e|test/.test(databaseName())) throw new Error('Run with `npm run test:load` (throwaway database).');
if (!JAVA_HOME) throw new Error('No Java found; see e2e/jmeter/README.md.');
if (!fs.existsSync(JMETER)) throw new Error(`JMeter not found at ${JMETER}; see e2e/jmeter/README.md.`);

function jmeter(args) {
  const r = spawnSync(JMETER, args, { stdio: 'inherit', env: { ...process.env, JAVA_HOME, HEAP: '-Xms512m -Xmx2g' } });
  if (r.status !== 0) throw new Error(`JMeter exited with ${r.status}`);
}

/** Per-label statistics from a JMeter CSV results file. */
function summarise(jtl) {
  const [head, ...lines] = fs.readFileSync(jtl, 'utf8').trim().split('\n');
  const cols = head.split(',');
  const at = (name) => cols.indexOf(name);
  const byLabel = new Map();
  for (const line of lines) {
    // label may contain commas inside quotes
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, ''));
    const label = cells[at('label')];
    const e = byLabel.get(label) || { times: [], errors: 0, first: Infinity, last: 0 };
    const ts = Number(cells[at('timeStamp')]); const el = Number(cells[at('elapsed')]);
    e.times.push(el); e.first = Math.min(e.first, ts); e.last = Math.max(e.last, ts + el);
    if (cells[at('success')] !== 'true') e.errors++;
    byLabel.set(label, e);
  }
  const pct = (s, p) => s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
  return [...byLabel].map(([label, e]) => {
    const s = [...e.times].sort((a, b) => a - b);
    return {
      operation: label, samples: s.length, mean: Math.round(s.reduce((a, b) => a + b, 0) / s.length),
      median: pct(s, 50), p90: pct(s, 90), p95: pct(s, 95), p99: pct(s, 99), min: s[0], max: s[s.length - 1],
      errorPct: +((100 * e.errors) / s.length).toFixed(2), throughput: +(s.length / ((e.last - e.first) / 1000)).toFixed(2),
    };
  });
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
await createAccounts();
const results = { started: new Date().toISOString(), levels: [], ocr: [], settings: { durationSeconds: DURATION, rampupSeconds: 10, thinkTimeMs: '500–1500' } };
try {
  const token = {};
  for (const r of ['admin', 'coach', 'judge']) token[r] = await apiToken(ACCOUNTS[r].email, ACCOUNTS[r].password);
  const judge = query(`App\\Models\\User::where('email', '${ACCOUNTS.judge.email}')->first(['id','name','email'])`);
  const pad = (n) => String(n).padStart(2, '0');
  const now = new Date(); const at = (ms) => { const d = new Date(now.getTime() + ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const game = await api('/events', { method: 'POST', token: token.admin, body: {
    name: `Load test game ${Date.now()}`, category: 'Basketball', schedule: today, startTime: at(-3600000), endTime: at(3600000),
    departments: [CAS, CICS], venueName: `Load Test Court ${Date.now()}`, judges: [judge], status: 'ongoing',
  } });
  const eventId = (game.event ?? game).id;
  await api('/scores', { method: 'POST', token: token.judge, body: { eventId, department: CICS, totalScore: 50 } });
  const session = await api('/attendance/sessions', { method: 'POST', token: token.coach, body: { title: 'Load test training', date: today, startTime: '17:00', endTime: '19:00' } });
  const roster = await api('/athletes', { token: token.coach });
  const athleteId = (Array.isArray(roster) ? roster : roster.data)[0].id;
  const props = {
    host: url.hostname, port: url.port || 80, protocol: url.protocol.replace(':', ''),
    adminToken: token.admin, coachToken: token.coach, judgeToken: token.judge,
    email: ACCOUNTS.athlete.email, password: ACCOUNTS.athlete.password,
    eventId, sessionId: (session.session ?? session).id, athleteId, deptA: CAS, deptB: CICS, sheet: SHEET,
    duration: DURATION, rampup: 10, think: 500,
  };
  const J = (extra) => Object.entries({ ...props, ...extra }).map(([k, v]) => `-J${k}=${v}`);

  for (const users of LEVELS) {
    console.log(`\n▶ ${users} concurrent users, ${DURATION} s per operation`);
    const jtl = path.join(OUT, `load-${users}users.jtl`);
    jmeter(['-n', '-t', path.join(here, 'sportaxis-load.jmx'), '-l', jtl, '-j', path.join(OUT, `jmeter-${users}.log`), ...J({ users })]);
    results.levels.push({ users, operations: summarise(jtl) });
  }
  const top = LEVELS[LEVELS.length - 1];
  jmeter(['-g', path.join(OUT, `load-${top}users.jtl`), '-o', path.join(OUT, `dashboard-${top}users`), '-j', path.join(OUT, 'jmeter-dashboard.log')]);

  if (fs.existsSync(SHEET)) {
    for (const users of OCR_LEVELS) {
      console.log(`\n▶ OCR extraction, ${users} at a time, 3 sheets each`);
      const jtl = path.join(OUT, `ocr-${users}users.jtl`);
      jmeter(['-n', '-t', path.join(here, 'sportaxis-ocr.jmx'), '-l', jtl, '-j', path.join(OUT, `jmeter-ocr-${users}.log`), ...J({ users, loops: 3, think: 0 })]);
      results.ocr.push({ users, operations: summarise(jtl) });
    }
  } else {
    console.log(`\n(no OCR test: ${path.relative(process.cwd(), SHEET)} not found; generate the OCR sheets first)`);
  }
} finally {
  await deleteAccounts();
  if (fs.existsSync(CAPTURES)) {
    for (const f of fs.readdirSync(CAPTURES)) if (!capturesBefore.has(f)) fs.rmSync(path.join(CAPTURES, f), { force: true });
  }
}
results.finished = new Date().toISOString();
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(results, null, 2));
const rows = [['concurrent users', 'operation', 'samples', 'mean ms', 'median ms', 'p90 ms', 'p95 ms', 'p99 ms', 'max ms', 'error %', 'throughput req/s']];
for (const kind of [results.levels, results.ocr]) {
  for (const l of kind) for (const o of l.operations) rows.push([l.users, o.operation, o.samples, o.mean, o.median, o.p90, o.p95, o.p99, o.max, o.errorPct, o.throughput]);
}
fs.writeFileSync(path.join(OUT, 'summary.csv'), rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n') + '\n');
console.log('\nOperation'.padEnd(46) + 'users  mean  p95  err%  req/s');
for (const kind of [results.levels, results.ocr]) for (const l of kind) for (const o of l.operations) {
  console.log(`${o.operation.padEnd(45)} ${String(l.users).padStart(5)} ${String(o.mean).padStart(5)} ${String(o.p95).padStart(5)} ${String(o.errorPct).padStart(5)} ${String(o.throughput).padStart(6)}`);
}
console.log(`\nReports: ${path.relative(process.cwd(), OUT)}/ (summary.csv, dashboard-${LEVELS[LEVELS.length - 1]}users/index.html)`);
