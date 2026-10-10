/**
 * Builds the SportAxis API test collection for Postman.
 *
 *   node e2e/postman/build-collection.mjs   → SportAxis-API.postman_collection.json
 *
 * The output is a normal Postman v2.1 collection: import it into the Postman
 * app, or run it with Newman (`npm run test:api`). Requests run in order and
 * hand values on through collection variables (tokens, the created game's
 * id, …). Every request checks its status code, its body and that it
 * answered within the response-time budget; the "refused" requests send
 * invalid input and pass only on a 4xx with a reason.
 *
 * Environment variables it expects (see SportAxis.postman_environment.example.json):
 *   baseUrl, adminEmail, coachEmail, athleteEmail, judgeEmail, password
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const BUDGET_MS = 2000; // response-time budget per request

const CAS = 'College of Arts and Sciences';
const CICS = 'College of Informatics and Computing Sciences';

/* ── test-script snippets ── */
const status = (code) =>
  Array.isArray(code)
    ? `pm.test("Status is one of ${code.join('/')}", () => pm.expect(pm.response.code).to.be.oneOf(${JSON.stringify(code)}));`
    : `pm.test("Status is ${code}", () => pm.response.to.have.status(${code}));`;
const fast = `pm.test("Responds within ${BUDGET_MS} ms", () => pm.expect(pm.response.responseTime).to.be.below(${BUDGET_MS}));`;
const json = `pm.test("Body is JSON", () => pm.response.to.be.json);`;
const refused = (code = 422) => [
  `pm.test("Refused with ${code}", () => pm.response.to.have.status(${code}));`,
  `pm.test("Not a server error", () => pm.expect(pm.response.code).to.be.below(500));`,
  `pm.test("Says why", () => { const b = pm.response.json(); pm.expect(b.message || b.error || b.errors).to.exist; });`,
];
const listOf = (key) =>
  `pm.test("Returns a list", () => { const b = pm.response.json(); const l = Array.isArray(b) ? b : (b.data ?? b${key ? `.${key}` : ''}); pm.expect(l).to.be.an("array"); });`;

/* ── request builder ── */
function req(name, method, url, { token, body, form, tests = [], pre = [] } = {}) {
  const header = [{ key: 'Accept', value: 'application/json' }];
  if (token) header.push({ key: 'Authorization', value: `Bearer {{${token}Token}}` });
  const item = {
    name,
    request: { method, header, url: { raw: `{{baseUrl}}${url}`, host: ['{{baseUrl}}'], path: url.split('?')[0].split('/').filter(Boolean) } },
    event: [{ listen: 'test', script: { type: 'text/javascript', exec: [...tests, fast] } }],
  };
  if (url.includes('?')) {
    item.request.url.query = url.split('?')[1].split('&').map((kv) => { const [key, value] = kv.split('='); return { key, value }; });
  }
  if (pre.length) item.event.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: pre } });
  if (body !== undefined) {
    header.push({ key: 'Content-Type', value: 'application/json' });
    item.request.body = { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } };
  }
  if (form) {
    item.request.body = {
      mode: 'formdata',
      formdata: Object.entries(form).map(([key, value]) =>
        typeof value === 'object' ? { key, type: 'file', src: value.file } : { key, value: String(value), type: 'text' }),
    };
  }
  return item;
}
const folder = (name, description, items) => ({ name, description, item: items });
const save = (variable, expr) => `pm.collectionVariables.set("${variable}", ${expr});`;

/* ── the collection ── */
const collection = {
  info: {
    name: 'SportAxis API',
    description:
      'Functional and negative tests of the SportAxis REST API, module by module. Run in order. ' +
      `Every request checks its status code, body and a ${BUDGET_MS} ms response-time budget; ` +
      'the "refused" requests send invalid input and must get a 4xx with a reason, never a 500.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'runId', value: '' },
    { key: 'today', value: '' },
    { key: 'startTime', value: '' },
    { key: 'endTime', value: '' },
  ],
  event: [
    {
      listen: 'prerequest',
      script: {
        type: 'text/javascript',
        exec: [
          '// Once per run: a run id for unique names, and today\'s date and a game window',
          '// that started an hour ago (so it can be scored and appealed).',
          'if (!pm.collectionVariables.get("runId")) {',
          '  const pad = (n) => String(n).padStart(2, "0");',
          '  const now = new Date();',
          '  const at = (ms) => { const d = new Date(now.getTime() + ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };',
          '  pm.collectionVariables.set("runId", Date.now().toString(36).slice(-5));',
          '  pm.collectionVariables.set("today", `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);',
          '  pm.collectionVariables.set("startTime", at(-3600000));',
          '  pm.collectionVariables.set("endTime", at(3600000));',
          '}',
        ],
      },
    },
  ],
  item: [
    folder('01 Public site', 'What anyone can read without signing in.', [
      req('List colleges', 'GET', '/departments', { tests: [status(200), json, listOf()] }),
      req('List sports', 'GET', '/categories', { tests: [status(200), json, listOf()] }),
      req('List venues', 'GET', '/venues', { tests: [status(200), json, listOf()] }),
      req('Current season', 'GET', '/seasons/current', { tests: [status(200), json] }),
      req('List games', 'GET', '/events', { tests: [status(200), json, listOf('events')] }),
      req('Live scores', 'GET', '/live-scores', { tests: [status(200), json] }),
      req('College leaderboard', 'GET', '/leaderboard', { tests: [status(200), json] }),
      req('List brackets', 'GET', '/brackets', { tests: [status(200), json] }),
      req('Announcements', 'GET', '/announcements', { tests: [status(200), json] }),
      req('Slideshow', 'GET', '/site-slides', { tests: [status(200), json] }),
      req('A game that does not exist → 404', 'GET', '/events/does-not-exist', { tests: [status(404)] }),
    ]),

    folder('02 Authentication', 'Signing in for each role, and what is refused.', [
      ...['admin', 'coach', 'athlete', 'judge'].map((role) =>
        req(`Sign in as ${role}`, 'POST', '/login', {
          body: { email: `{{${role}Email}}`, password: '{{password}}' },
          tests: [
            status(200), json,
            `pm.test("Returns a token and the ${role} account", () => { const b = pm.response.json(); pm.expect(b.token).to.be.a("string"); pm.expect(b.user.role).to.eql("${role}"); });`,
            save(`${role}Token`, 'pm.response.json().token'),
            save(`${role}Id`, 'pm.response.json().user.id'),
            save(`${role}Name`, 'pm.response.json().user.name'),
          ],
        })),
      req('Who am I (admin)', 'GET', '/user', { token: 'admin', tests: [status(200), json, 'pm.test("Is the admin", () => pm.expect(pm.response.json().role ?? pm.response.json().user?.role).to.eql("admin"));'] }),
      req('Refused: wrong password', 'POST', '/login', { body: { email: '{{adminEmail}}', password: 'not-the-password' }, tests: [status([401, 422]), 'pm.test("No token", () => pm.expect(pm.response.json().token).to.be.undefined);'] }),
      req('Refused: malformed email', 'POST', '/login', { body: { email: 'not-an-email', password: 'x12345678' }, tests: refused(422) }),
      req('Refused: no token', 'GET', '/user', { tests: [status(401)] }),
      req('Refused: forged token', 'GET', '/admin/users', { tests: [status(401)], pre: [] }),
    ]),

    folder('03 Registration codes', 'The office issues sign-up codes.', [
      req('Create a coach code', 'POST', '/registration-codes', {
        token: 'admin', body: { role: 'coach', label: 'Postman {{runId}}', expiresInDays: 7 },
        tests: [status(201), json, 'pm.test("Returns the new code", () => pm.expect(pm.response.json().code).to.be.a("string").and.have.length.above(3));'],
      }),
      req('List codes', 'GET', '/registration-codes', { token: 'admin', tests: [status(200), json] }),
      req('Refused: expires in -5 days', 'POST', '/registration-codes', { token: 'admin', body: { role: 'coach', expiresInDays: -5 }, tests: refused(422) }),
      req('Refused: expires in 99,999,999 days', 'POST', '/registration-codes', { token: 'admin', body: { role: 'coach', expiresInDays: 99999999 }, tests: refused(422) }),
      req('Refused: a coach issuing codes', 'POST', '/registration-codes', { token: 'coach', body: { role: 'admin' }, tests: [status(403)] }),
    ]),

    folder('04 Venues, seasons, sports', 'Reference data the office manages.', [
      req('Create a venue', 'POST', '/venues', {
        token: 'admin', body: { name: 'Postman Court {{runId}}', type: 'indoor', capacity: 300, location: 'Test Building', status: 'available', sports: ['Basketball'] },
        tests: [status(201), json, save('venueId', 'pm.response.json().id'), 'pm.test("Saved the capacity", () => pm.expect(pm.response.json().capacity).to.eql(300));'],
      }),
      req('Update the venue', 'PUT', '/venues/{{venueId}}', { token: 'admin', body: { capacity: 350 }, tests: [status(200), json] }),
      req('Refused: capacity 0', 'POST', '/venues', { token: 'admin', body: { name: 'Bad {{runId}}', type: 'indoor', capacity: 0, location: 'X' }, tests: refused(422) }),
      req('Refused: 300-character venue name', 'POST', '/venues', { token: 'admin', body: { name: 'x'.repeat(300), type: 'indoor', capacity: 10, location: 'X' }, tests: refused(422) }),
      req('Create a season', 'POST', '/seasons', { token: 'admin', body: { name: 'Postman Season {{runId}}', startsOn: '2031-01-01', endsOn: '2031-12-31' }, tests: [status(201), json] }),
      req('Refused: season ends before it starts', 'POST', '/seasons', { token: 'admin', body: { name: 'Bad Season {{runId}}', startsOn: '2031-06-01', endsOn: '2031-01-01' }, tests: refused(422) }),
      req('Create a sport', 'POST', '/categories', { token: 'admin', body: { name: 'Postman Sport {{runId}}', description: 'From the API tests', format: 'versus' }, tests: [status(201), json] }),
      req('Refused: duplicate sport', 'POST', '/categories', { token: 'admin', body: { name: 'Basketball' }, tests: refused(422) }),
    ]),

    folder('05 Games and committee', 'Creating a game with its committee member, and the scheduling rules.', [
      req('Create a game with a committee member', 'POST', '/events', {
        token: 'admin',
        body: {
          name: 'Postman Game {{runId}}', category: 'Basketball', schedule: '{{today}}', startTime: '{{startTime}}', endTime: '{{endTime}}',
          departments: [CAS, CICS], venueId: '{{venueId}}', judges: [{ id: '{{judgeId}}', name: '{{judgeName}}', email: '{{judgeEmail}}' }], status: 'upcoming',
        },
        tests: [status(201), json, save('eventId', '(pm.response.json().event ?? pm.response.json()).id'),
          'pm.test("Has both colleges", () => pm.expect((pm.response.json().event ?? pm.response.json()).departments).to.have.length(2));'],
      }),
      req('Read the game', 'GET', '/events/{{eventId}}', { tests: [status(200), json, 'pm.test("Is the created game", () => pm.expect((pm.response.json().event ?? pm.response.json()).id).to.eql(pm.collectionVariables.get("eventId")));'] }),
      req('Refused: ends before it starts', 'POST', '/events', { token: 'admin', body: { name: 'Bad {{runId}}', category: 'Basketball', schedule: '2031-02-10', startTime: '10:00', endTime: '09:00', departments: [CAS, CICS] }, tests: refused(422) }),
      req('Refused: start time 25:99', 'POST', '/events', { token: 'admin', body: { name: 'Bad {{runId}}', category: 'Basketball', schedule: '2031-02-10', startTime: '25:99', endTime: '26:30', departments: [CAS, CICS] }, tests: refused(422) }),
      req('Refused: February 30', 'POST', '/events', { token: 'admin', body: { name: 'Bad {{runId}}', category: 'Basketball', schedule: '2031-02-30', startTime: '09:00', endTime: '10:00', departments: [CAS, CICS] }, tests: refused(422) }),
      req('Refused: same college twice', 'POST', '/events', { token: 'admin', body: { name: 'Bad {{runId}}', category: 'Basketball', schedule: '2031-02-10', startTime: '09:00', endTime: '10:00', departments: [CAS, CAS] }, tests: refused(422) }),
      req('Refused: double-booking the venue', 'POST', '/events', { token: 'admin', body: { name: 'Clash {{runId}}', category: 'Basketball', schedule: '{{today}}', startTime: '{{startTime}}', endTime: '{{endTime}}', departments: [CAS, CICS], venueId: '{{venueId}}' }, tests: refused(422) }),
      req('Refused: a coach as the committee', 'POST', '/events', { token: 'admin', body: { name: 'Bad {{runId}}', category: 'Basketball', schedule: '2031-02-11', startTime: '09:00', endTime: '10:00', departments: [CAS, CICS], judges: [{ id: '{{coachId}}', name: 'Coach' }] }, tests: refused(422) }),
      req('Refused: a coach creating a game', 'POST', '/events', { token: 'coach', body: { name: 'X', category: 'Basketball', schedule: '2031-02-12', startTime: '09:00', endTime: '10:00', departments: [CAS, CICS] }, tests: [status(403)] }),
    ]),

    folder('06 Scoring (mobile app calls)', 'What the committee\'s mobile app sends, then the official result.', [
      req('Live score: game starts (10–8)', 'PUT', '/events/{{eventId}}/live', { token: 'judge', body: { homeScore: 10, awayScore: 8, status: 'in_progress', method: 'live' }, tests: [status(200), json, 'pm.test("Live score saved", () => pm.expect(pm.response.json().live.homeScore).to.eql(10));'] }),
      req('Live scores list shows it', 'GET', '/live-scores', { tests: [status(200), 'pm.test("The game is live", () => pm.expect(JSON.stringify(pm.response.json())).to.include(pm.collectionVariables.get("eventId")));'] }),
      req('Final: game ends (21–15)', 'PUT', '/events/{{eventId}}/live', { token: 'judge', body: { homeScore: 21, awayScore: 15, status: 'final' }, tests: [status(200), json] }),
      req(`Final score: ${CAS}`, 'POST', '/scores', { token: 'judge', body: { eventId: '{{eventId}}', department: CAS, totalScore: 21 }, tests: [status(201), json] }),
      req(`Final score: ${CICS}`, 'POST', '/scores', { token: 'judge', body: { eventId: '{{eventId}}', department: CICS, totalScore: 15 }, tests: [status(201), json] }),
      req('Committee status shows the score was submitted', 'GET', '/judge/{{judgeId}}/status?eventId={{eventId}}', { tests: [status(200), json, 'pm.test("Submitted", () => pm.expect(pm.response.json().submitted).to.eql(true));'] }),
      req('Refused: score of 101', 'POST', '/scores', { token: 'judge', body: { eventId: '{{eventId}}', department: CAS, totalScore: 101 }, tests: refused(422) }),
      req('Refused: score for a college not in the game', 'POST', '/scores', { token: 'judge', body: { eventId: '{{eventId}}', department: 'College of Teacher Education', totalScore: 50 }, tests: refused(422) }),
      req('Refused: live score of -3', 'PUT', '/events/{{eventId}}/live', { token: 'judge', body: { homeScore: -3 }, tests: refused(422) }),
      req('Refused: a coach submitting a score', 'POST', '/scores', { token: 'coach', body: { eventId: '{{eventId}}', department: CAS, totalScore: 50 }, tests: [status(403)] }),
      req('Rankings for the game', 'GET', '/rankings/{{eventId}}', { tests: [status(200), json, `pm.test("${CAS} ranks first", () => { const r = pm.response.json(); const list = Array.isArray(r) ? r : (r.rankings ?? r.data); pm.expect(list[0].department).to.eql("${CAS}"); });`] }),
      req('Office makes the result official', 'POST', '/events/{{eventId}}/officialize', { token: 'admin', tests: [status(200), json] }),
      req('Result sheet (JSON)', 'GET', '/reports/events/{{eventId}}', { token: 'admin', tests: [status(200), json] }),
      req('Standings export (CSV)', 'GET', '/reports/leaderboard/export?format=csv', { token: 'admin', tests: [status(200), 'pm.test("Is a CSV file", () => pm.expect(pm.response.headers.get("Content-Type")).to.include("csv"));'] }),
    ]),

    folder('07 Coaching', 'Roster, training attendance, performance, announcements.', [
      req("Coach's roster", 'GET', '/athletes', { token: 'coach', tests: [status(200), json, save('athleteRowId', '(Array.isArray(pm.response.json()) ? pm.response.json() : pm.response.json().data)[0].id'), save('athleteRowName', '(() => { const a = (Array.isArray(pm.response.json()) ? pm.response.json() : pm.response.json().data)[0]; return `${a.firstName} ${a.lastName}`; })()')] }),
      req('Schedule a training session', 'POST', '/attendance/sessions', { token: 'coach', body: { title: 'Postman Training {{runId}}', date: '{{today}}', startTime: '17:00', endTime: '19:00' }, tests: [status(201), json, save('sessionId', '(pm.response.json().session ?? pm.response.json()).id')] }),
      req('Take attendance', 'POST', '/attendance/sessions/{{sessionId}}/records', { token: 'coach', body: { records: [{ athleteId: '{{athleteRowId}}', status: 'present' }] }, tests: [status([200, 201]), json] }),
      req('Refused: session ends before it starts', 'POST', '/attendance/sessions', { token: 'coach', body: { title: 'Bad', date: '{{today}}', startTime: '19:00', endTime: '17:00' }, tests: refused(422) }),
      req('Record performance in the game', 'POST', '/performance', { token: 'coach', body: { athleteId: '{{athleteRowId}}', athleteName: '{{athleteRowName}}', eventId: '{{eventId}}', overallRating: 8, coachNotes: 'Postman run {{runId}}' }, tests: [status(201), json] }),
      req('Refused: rating 11 (1–10)', 'POST', '/performance', { token: 'coach', body: { athleteId: '{{athleteRowId}}', athleteName: 'X', eventId: '{{eventId}}', overallRating: 11 }, tests: refused(422) }),
      req('Post an announcement', 'POST', '/announcements', { token: 'coach', body: { title: 'Postman notice {{runId}}', content: 'Training moved to 5 PM.', isTryout: false }, tests: [status(201), json] }),
      req('Refused: 300-character announcement title', 'POST', '/announcements', { token: 'coach', body: { title: 'x'.repeat(300), content: 'x', isTryout: false }, tests: refused(422) }),
      req('Refused: tryout dated in the past', 'POST', '/announcements', { token: 'coach', body: { title: 'Old tryout {{runId}}', content: 'x', isTryout: true, tryoutDate: '2020-01-01', tryoutStartTime: '16:00', tryoutEndTime: '18:00' }, tests: refused(422) }),
      req('Coach profile', 'GET', '/coach/profile', { token: 'coach', tests: [status(200), json] }),
    ]),

    folder('08 CMO requirements', 'Athlete uploads; coach and office review.', [
      req('Athlete uploads a document (PDF)', 'POST', '/requirements', { token: 'athlete', form: { type: 'medical', name: 'Medical Clearance', description: 'Postman upload', file: { file: 'selenium/fixtures/document.pdf' } }, tests: [status(201), json] }),
      req('Refused: a .txt file', 'POST', '/requirements', { token: 'athlete', form: { type: 'medical', name: 'Notes', file: { file: 'postman/fixtures/notes.txt' } }, tests: refused(422) }),
      req("Athlete's clearance", 'GET', '/requirements/my/clearance', { token: 'athlete', tests: [status(200), json] }),
      req('Coach sees the CMO roster', 'GET', '/cmo/roster', { token: 'coach', tests: [status(200), json, listOf()] }),
      req('Refused: forwarding nobody', 'POST', '/cmo/submissions', { token: 'coach', body: { athleteIds: [] }, tests: refused(422) }),
      req('Office overview', 'GET', '/cmo/overview', { token: 'admin', tests: [status(200), json] }),
    ]),

    folder('09 Appeals', 'A coach appeals the game with the formal form.', [
      req('Coach files an appeal (PDF form)', 'POST', '/protests', { token: 'coach', form: { eventId: '{{eventId}}', reason: 'The last basket came after the buzzer and should not count.', form: { file: 'selenium/fixtures/document.pdf' } }, tests: [status(201), json] }),
      req('Refused: a second open appeal on the same game', 'POST', '/protests', { token: 'coach', form: { eventId: '{{eventId}}', reason: 'Trying to appeal the same game twice here.', form: { file: 'selenium/fixtures/document.pdf' } }, tests: refused(422) }),
      req('Refused: reason under 15 characters', 'POST', '/protests', { token: 'coach', form: { eventId: '{{eventId}}', reason: 'unfair', form: { file: 'selenium/fixtures/document.pdf' } }, tests: refused(422) }),
      req('Office lists the appeals', 'GET', '/protests', { token: 'admin', tests: [status(200), json] }),
    ]),

    folder('10 Users and access', 'Account management and role checks.', [
      req('Office lists users', 'GET', '/admin/users', { token: 'admin', tests: [status(200), json] }),
      req('Refused: an athlete listing users', 'GET', '/admin/users', { token: 'athlete', tests: [status(403)] }),
      req('Refused: a made-up role', 'PUT', '/admin/users/{{judgeId}}', { token: 'admin', body: { role: 'god' }, tests: refused(422) }),
      req('Refused: wrong current password', 'PUT', '/account/password', { token: 'athlete', body: { currentPassword: 'definitely-wrong-1', newPassword: 'New-pass-1234', newPassword_confirmation: 'New-pass-1234' }, tests: [status(400), 'pm.test("Says why", () => pm.expect(pm.response.json().error).to.exist);'] }),
      req('Notifications (coach)', 'GET', '/notifications', { token: 'coach', tests: [status(200), json] }),
      req('Office transaction queue', 'GET', '/admin/transactions', { token: 'admin', tests: [status(200), json] }),
      req('Audit trail', 'GET', '/admin/audit-logs', { token: 'admin', tests: [status(200), json] }),
      req('Recycle bin', 'GET', '/admin/trash', { token: 'admin', tests: [status(200), json] }),
    ]),

    folder('11 Clean up', 'Delete what the run created that can be deleted.', [
      req('Delete the game (to the recycle bin)', 'DELETE', '/events/{{eventId}}', { token: 'admin', tests: [status(200)] }),
      req('Restore the game', 'POST', '/events/{{eventId}}/restore', { token: 'admin', tests: [status(200)] }),
      req('Sign out (coach)', 'POST', '/logout', { token: 'coach', tests: [status(200)] }),
    ]),
  ],
};

// The forged-token request carries a token that was never issued.
const forged = collection.item[1].item.find((i) => i.name === 'Refused: forged token');
forged.request.header.push({ key: 'Authorization', value: 'Bearer 999|forged-token-value' });

const out = path.join(here, 'SportAxis-API.postman_collection.json');
fs.writeFileSync(out, JSON.stringify(collection, null, 2) + '\n');
const count = collection.item.reduce((n, f) => n + f.item.length, 0);
console.log(`Wrote ${path.relative(process.cwd(), out)}: ${collection.item.length} folders, ${count} requests.`);
