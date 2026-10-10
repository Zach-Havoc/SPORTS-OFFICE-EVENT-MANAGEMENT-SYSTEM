/**
 * Error catcher, part 1: the server refuses bad input on its own.
 *
 * The website checks a lot in the browser, but anyone can send a request
 * without it (a tampered page, a script, an old app). So every probe here
 * goes straight to the API, the way such a request would, with input a
 * user could plausibly type or a tamperer could send. Each must be:
 *
 *   - refused with a 4xx answer and a reason (a 500 means the input
 *     crashed the server instead of being checked), and
 *   - leave the database unchanged (`table` is counted before and after).
 *
 * Runs on the throwaway database only (`npm run test:e2e:auto`).
 */
import assert from 'node:assert/strict';
import { ACCOUNTS } from '../support/accounts.mjs';
import { api, apiToken, attempt, databaseName, query } from '../support/backend.mjs';

const RUN = Date.now().toString(36).slice(-5);
const CAS = 'College of Arts and Sciences';
const CICS = 'College of Informatics and Computing Sciences';
const LONG = 'x'.repeat(300); // past every VARCHAR(255) column
const pad = (n) => String(n).padStart(2, '0');
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
const hm = (ms) => { const d = new Date(Date.now() + ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const PDF = { name: 'form.pdf', type: 'application/pdf', bytes: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n') };
const TXT = { name: 'notes.txt', type: 'text/plain', bytes: Buffer.from('not a document') };
const EXE = { name: 'virus.pdf.exe', type: 'application/octet-stream', bytes: Buffer.from('MZ\x90\x00 fake program') };
const FAKE_PDF = { name: 'fake.pdf', type: 'application/pdf', bytes: Buffer.from('<?php echo "hi"; ?>') };
const BIG_PDF = { name: 'big.pdf', type: 'application/pdf', bytes: Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(11 * 1024 * 1024, 32)]) };

const T = {}; // tokens
const D = {}; // ids the probes need

const count = (table, where = '') => query(`DB::table('${table}')${where}->count()`);

/**
 * One probe: send it, expect a refusal, and that `table` didn't change.
 * Returns the answer so a probe can check more.
 */
async function refuse({ as, method = 'POST', path, body, files, table, where = '' }) {
  const before = table ? count(table, where) : null;
  const res = await attempt(path, { method, token: as ? T[as] : undefined, body, files });
  const shown = typeof res.data === 'string' ? res.data : JSON.stringify(res.data).slice(0, 220);
  assert.notEqual(res.status, 500, `The server crashed (500) instead of refusing: ${shown}`);
  assert.ok(res.status >= 400 && res.status < 500, `Expected a refusal (4xx), got ${res.status}: ${shown}`);
  if (table) {
    assert.equal(count(table, where), before, `${table} changed although the request was refused`);
  }
  return res;
}

describe('Error catcher — the server refuses bad input', function () {
  before(async function () {
    this.timeout(120000);
    if (process.env.E2E_WRITES !== '1') throw new Error('Run with `npm run test:e2e:auto` (throwaway database).');
    if (!/e2e|test/.test(databaseName())) throw new Error('Refusing to run outside the throwaway database.');

    for (const role of ['admin', 'coach', 'athlete', 'judge']) {
      T[role] = await apiToken(ACCOUNTS[role].email, ACCOUNTS[role].password);
    }
    D.coachId = query(`App\\Models\\User::where('email', '${ACCOUNTS.coach.email}')->value('id')`);
    D.judge = query(`App\\Models\\User::where('email', '${ACCOUNTS.judge.email}')->first(['id','name','email'])`);
    D.athleteRow = query(`App\\Models\\Athlete::where('coach_id', '${D.coachId}')->value('id')`);
    D.otherAthlete = query(`App\\Models\\Athlete::where('coach_id', '!=', '${D.coachId}')->whereNotNull('coach_id')->value('id')`);
    D.someEvent = query(`App\\Models\\Event::where('category', '!=', 'Basketball')->value('id')`);

    // A valid game first (control: if this fails, the probes prove nothing).
    const game = await api('/events', {
      method: 'POST',
      token: T.admin,
      body: {
        name: `ERR Game ${RUN}`, category: 'Basketball', schedule: today,
        startTime: hm(-3600000), endTime: hm(3600000), departments: [CAS, CICS],
        venueName: `ERR Court ${RUN}`, judges: [D.judge], status: 'upcoming',
      },
    });
    D.eventId = (game.event ?? game).id;
    assert.ok(D.eventId, 'the control game was created');
    D.notStarted = (await api('/events', {
      method: 'POST',
      token: T.admin,
      body: {
        name: `ERR Later ${RUN}`, category: 'Basketball', schedule: '2030-01-15',
        startTime: '09:00', endTime: '10:00', departments: [CAS, CICS], venueName: `ERR Court ${RUN}`,
      },
    })).id;
  });

  /* ── Signing in and signing up ── */
  describe('Sign in, sign up, password reset', () => {
    it('sign in with a malformed email', () => refuse({ path: '/login', body: { email: 'not-an-email', password: 'whatever1' } }));
    it("sign in with an injection-style email (' OR 1=1 --)", () => refuse({ path: '/login', body: { email: "' OR 1=1 --", password: "' OR '1'='1" } }));
    it('sign in with no password', () => refuse({ path: '/login', body: { email: ACCOUNTS.admin.email } }));
    const signup = (over) => ({
      email: `err.${RUN}.${Math.random().toString(36).slice(2, 6)}@e2e.sportaxis.test`, password: 'Valid-pass-123',
      name: 'Err Tester', role: 'coach', registrationCode: 'NOPE-0000', privacyNoticeAccepted: true, ...over,
    });
    it('sign up with a 5-character password', () => refuse({ path: '/signup', body: signup({ password: 'abc12' }), table: 'users' }));
    it('sign up as a made-up role ("superadmin")', () => refuse({ path: '/signup', body: signup({ role: 'superadmin' }), table: 'users' }));
    it('sign up without accepting the privacy notice', () => refuse({ path: '/signup', body: signup({ privacyNoticeAccepted: false }), table: 'users' }));
    it('sign up with a code that does not exist', () => refuse({ path: '/signup', body: signup(), table: 'users' }));
    it('sign up with a 300-character email', () => refuse({ path: '/signup', body: signup({ email: `${LONG}@e2e.sportaxis.test` }), table: 'users' }));
    it('sign up with an email that is already registered', () => refuse({ path: '/signup', body: signup({ email: ACCOUNTS.admin.email }), table: 'users' }));
    it('sign up as an athlete with an SR code not on the registrar list', () =>
      refuse({ path: '/signup', body: signup({ role: 'athlete', srCode: '00-00000' }), table: 'users' }));
    it('password reset for a malformed email', () => refuse({ path: '/reset-password', body: { email: 'nobody@' } }));
  });

  /* ── Registration codes ── */
  describe('Registration codes', () => {
    for (const [label, days] of [['0 days', 0], ['-5 days', -5], ['"abc" days', 'abc'], ['99,999,999 days (year 270,000)', 99999999]]) {
      it(`expiring in ${label}`, () =>
        refuse({ as: 'admin', path: '/registration-codes', body: { role: 'coach', expiresInDays: days }, table: 'registration_codes' }));
    }
    it('for a made-up role ("owner")', () => refuse({ as: 'admin', path: '/registration-codes', body: { role: 'owner' }, table: 'registration_codes' }));
    it('made by a coach (not the office)', () => refuse({ as: 'coach', path: '/registration-codes', body: { role: 'admin' }, table: 'registration_codes' }));
  });

  /* ── Venues ── */
  describe('Venues', () => {
    const venue = (over) => ({ name: `ERR Venue ${RUN}`, type: 'indoor', capacity: 100, location: 'Test', status: 'available', ...over });
    for (const [label, cap] of [['0', 0], ['-10', -10], ['"abc"', 'abc'], ['1,000,000,000,000', 1e12], ['2.5', 2.5]]) {
      it(`capacity ${label}`, () => refuse({ as: 'admin', path: '/venues', body: venue({ capacity: cap }), table: 'venues' }));
    }
    it('a blank name (only spaces)', () => refuse({ as: 'admin', path: '/venues', body: venue({ name: '    ' }), table: 'venues' }));
    it('a 300-character name', () => refuse({ as: 'admin', path: '/venues', body: venue({ name: LONG }), table: 'venues' }));
    // The type is a free description ("Covered Court", "Gymnasium"), so only its length is limited.
    it('a 101-character type', () => refuse({ as: 'admin', path: '/venues', body: venue({ type: 'y'.repeat(101) }), table: 'venues' }));
    it('a made-up status ("broken")', () => refuse({ as: 'admin', path: '/venues', body: venue({ status: 'broken' }), table: 'venues' }));
  });

  /* ── Seasons, sports, colleges ── */
  describe('Seasons, sports and colleges', () => {
    it('a season that ends before it starts', () =>
      refuse({ as: 'admin', path: '/seasons', body: { name: `ERR S1 ${RUN}`, startsOn: '2027-06-01', endsOn: '2027-01-01' }, table: 'seasons' }));
    it('a season with a start date "not-a-date"', () =>
      refuse({ as: 'admin', path: '/seasons', body: { name: `ERR S2 ${RUN}`, startsOn: 'not-a-date' }, table: 'seasons' }));
    it('a season with February 30', () =>
      refuse({ as: 'admin', path: '/seasons', body: { name: `ERR S3 ${RUN}`, startsOn: '2027-02-30' }, table: 'seasons' }));
    it('a sport with no name', () => refuse({ as: 'admin', path: '/categories', body: { name: '' }, table: 'categories' }));
    it('a sport that already exists ("Basketball")', () => refuse({ as: 'admin', path: '/categories', body: { name: 'Basketball' }, table: 'categories' }));
    it('a sport with a 300-character name', () => refuse({ as: 'admin', path: '/categories', body: { name: LONG }, table: 'categories' }));
    it('a sport with a made-up format ("teams")', () => refuse({ as: 'admin', path: '/categories', body: { name: `ERR Sport ${RUN}`, format: 'teams' }, table: 'categories' }));
    it('a college that already exists', () => refuse({ as: 'admin', path: '/departments', body: { name: CAS }, table: 'departments' }));
    it('a college with a 300-character name', () => refuse({ as: 'admin', path: '/departments', body: { name: LONG }, table: 'departments' }));
  });

  /* ── Events ── */
  describe('Games (events)', () => {
    const game = (over) => ({
      name: `ERR Bad ${RUN}`, category: 'Basketball', schedule: '2030-02-10', startTime: '09:00', endTime: '10:00',
      departments: [CAS, CICS], venueName: `ERR Hall ${RUN}`, ...over,
    });
    const bad = (label, over) => it(label, () => refuse({ as: 'admin', path: '/events', body: game(over), table: 'events' }));
    bad('ends before it starts (10:00 → 09:00)', { startTime: '10:00', endTime: '09:00' });
    bad('ends when it starts (09:00 → 09:00)', { endTime: '09:00' });
    bad('a start time of 25:99', { startTime: '25:99', endTime: '26:30' });
    bad('a start time of "noon-ish"', { startTime: 'noon-ish', endTime: 'later' });
    bad('a start time of 10:75', { startTime: '10:75', endTime: '11:30' });
    bad('on February 30', { schedule: '2030-02-30' });
    bad('on "next Tuesday"', { schedule: 'next Tuesday' });
    bad('the same college on both sides', { departments: [CAS, CAS] });
    bad('only one college for a two-team sport', { departments: [CAS] });
    // Design question, not enforced yet: games may name a sport or college
    // that isn't registered (the tests document this; colleges also go by
    // abbreviation). Only the office can create games, and the site only
    // offers real names. Un-skip these if the office wants it enforced.
    it.skip('[design question] a college that does not exist ("Hogwarts")', () =>
      refuse({ as: 'admin', path: '/events', body: game({ departments: [CAS, 'Hogwarts'] }), table: 'events' }));
    it.skip('[design question] a sport that does not exist ("Quidditch")', () =>
      refuse({ as: 'admin', path: '/events', body: game({ category: 'Quidditch' }), table: 'events' }));
    bad('a made-up status ("cancelled")', { status: 'cancelled' });
    bad('two committee members', { judges: [{ id: 'a' }, { id: 'b' }] });
    it('a coach assigned as the committee', () =>
      refuse({ as: 'admin', path: '/events', body: game({ judges: [{ id: D.coachId, name: 'Coach', email: ACCOUNTS.coach.email }] }), table: 'events' }));
    bad('a 300-character name', { name: LONG });
    bad('a name of only spaces', { name: '     ' });
    it('double-booking a venue (same court, overlapping time)', async () => {
      // A court of its own, so earlier runs' bookings don't get in the way.
      const venueId = (await api('/venues', { method: 'POST', token: T.admin, body: { name: `ERR Booking ${RUN}`, type: 'indoor', capacity: 50, location: 'Test', status: 'available' } })).id;
      await api('/events', { method: 'POST', token: T.admin, body: game({ name: `ERR Booked ${RUN}`, schedule: '2030-03-03', venueId, venueName: undefined }) });
      await refuse({ as: 'admin', path: '/events', body: game({ name: `ERR Clash ${RUN}`, schedule: '2030-03-03', startTime: '09:30', endTime: '10:30', venueId, venueName: undefined }), table: 'events' });
    });
    it('created by a coach (not the office)', () => refuse({ as: 'coach', path: '/events', body: game(), table: 'events' }));
  });

  /* ── Scoring ── */
  describe('Scoring (as the mobile app sends it)', () => {
    const score = (over) => ({ eventId: D.eventId, department: CAS, totalScore: 50, ...over });
    for (const [label, v] of [['101', 101], ['-1', -1], ['"ten"', 'ten']]) {
      it(`a final score of ${label}`, () => refuse({ as: 'judge', path: '/scores', body: score({ totalScore: v }), table: 'scores' }));
    }
    it('a score for a college that did not play the game', () =>
      refuse({ as: 'judge', path: '/scores', body: score({ department: 'College of Teacher Education' }), table: 'scores' }));
    it('a score for a game the committee member is not assigned to', () =>
      refuse({ as: 'judge', path: '/scores', body: score({ eventId: D.someEvent }), table: 'scores' }));
    it('a score sent by a coach', () => refuse({ as: 'coach', path: '/scores', body: score(), table: 'scores' }));
    it('a live score of -3', () => refuse({ as: 'judge', method: 'PUT', path: `/events/${D.eventId}/live`, body: { homeScore: -3, awayScore: 0 }, table: 'live_scores' }));
    it('a live score of "abc"', () => refuse({ as: 'judge', method: 'PUT', path: `/events/${D.eventId}/live`, body: { homeScore: 'abc' }, table: 'live_scores' }));
    it('a live status of "paused"', () => refuse({ as: 'judge', method: 'PUT', path: `/events/${D.eventId}/live`, body: { status: 'paused' }, table: 'live_scores' }));
  });

  /* ── Coaching ── */
  describe('Coaching records', () => {
    const perf = (over) => ({ athleteId: D.athleteRow, athleteName: 'Ana Tester', eventId: D.eventId, overallRating: 7, ...over });
    for (const [label, r] of [['0', 0], ['11', 11], ['-4', -4], ['"great"', 'great']]) {
      it(`a performance rating of ${label} (1–10)`, () => refuse({ as: 'coach', path: '/performance', body: perf({ overallRating: r }), table: 'performance_records' }));
    }
    it("a performance record for another coach's athlete", () =>
      refuse({ as: 'coach', path: '/performance', body: perf({ athleteId: D.otherAthlete }), table: 'performance_records' }));
    const session = (over) => ({ title: `ERR Training ${RUN}`, date: '2030-04-01', startTime: '17:00', endTime: '19:00', ...over });
    it('a training session that ends before it starts', () =>
      refuse({ as: 'coach', path: '/attendance/sessions', body: session({ startTime: '19:00', endTime: '17:00' }), table: 'attendance_sessions' }));
    it('a training session on "tomorrow-ish"', () =>
      refuse({ as: 'coach', path: '/attendance/sessions', body: session({ date: 'tomorrow-ish' }), table: 'attendance_sessions' }));
    it('a training session with a blank title', () =>
      refuse({ as: 'coach', path: '/attendance/sessions', body: session({ title: '   ' }), table: 'attendance_sessions' }));
    it('a training session at 24:61', () =>
      refuse({ as: 'coach', path: '/attendance/sessions', body: session({ startTime: '24:61', endTime: '25:00' }), table: 'attendance_sessions' }));
    it('a repeating schedule that ends before it starts', () =>
      refuse({ as: 'coach', path: '/attendance/sessions/recurring', body: { title: 'ERR', from: '2030-05-10', to: '2030-05-01', weekdays: [1] }, table: 'attendance_sessions' }));
    it('a repeating schedule on weekday 9', () =>
      refuse({ as: 'coach', path: '/attendance/sessions/recurring', body: { title: 'ERR', from: '2030-05-01', to: '2030-05-10', weekdays: [9] }, table: 'attendance_sessions' }));
    it('a repeating schedule longer than 180 days', () =>
      refuse({ as: 'coach', path: '/attendance/sessions/recurring', body: { title: 'ERR', from: '2030-01-01', to: '2031-01-01', weekdays: [1] }, table: 'attendance_sessions' }));
    it('an athlete added with an invalid email', () =>
      refuse({ as: 'coach', path: '/athletes', body: { studentId: `95-${RUN.slice(0, 5)}`, firstName: 'A', lastName: 'B', email: 'not-an-email' }, table: 'athletes' }));
    it('an athlete added with a student ID that already exists', () => {
      const taken = query(`App\\Models\\Athlete::whereNotNull('student_id')->value('student_id')`);
      return refuse({ as: 'coach', path: '/athletes', body: { studentId: taken, firstName: 'A', lastName: 'B', email: 'ab@example.com' }, table: 'athletes' });
    });
    it('an athlete added with a made-up status ("retired")', () =>
      refuse({ as: 'coach', path: '/athletes', body: { studentId: `94-${RUN.slice(0, 5)}`, firstName: 'A', lastName: 'B', email: 'ab@example.com', status: 'retired' }, table: 'athletes' }));
    it('an announcement with a blank title', () =>
      refuse({ as: 'coach', path: '/announcements', body: { title: '  ', content: 'x', isTryout: false }, table: 'announcements' }));
    it('an announcement with a 300-character title', () =>
      refuse({ as: 'coach', path: '/announcements', body: { title: LONG, content: 'x', isTryout: false }, table: 'announcements' }));
    it('a tryout that ends before it starts', () =>
      refuse({ as: 'coach', path: '/announcements', body: { title: `ERR Tryout ${RUN}`, content: 'x', isTryout: true, tryoutDate: '2030-06-01', tryoutStartTime: '18:00', tryoutEndTime: '16:00' }, table: 'announcements' }));
    it('a tryout dated in the past', () =>
      refuse({ as: 'coach', path: '/announcements', body: { title: `ERR Old ${RUN}`, content: 'x', isTryout: true, tryoutDate: '2020-01-01', tryoutStartTime: '16:00', tryoutEndTime: '18:00' }, table: 'announcements' }));
  });

  /* ── Uploads ── */
  describe('File uploads', () => {
    const req = (file) => refuse({ as: 'athlete', path: '/requirements', body: { type: 'medical', name: 'Medical Clearance' }, files: { file }, table: 'requirements' });
    it('a requirement uploaded as a .txt file', () => req(TXT));
    it('a requirement uploaded as a program (.exe)', () => req(EXE));
    it('a requirement named .pdf that is really PHP code', () => req(FAKE_PDF));
    it('a requirement of 11 MB (limit 10 MB)', () => req(BIG_PDF));
    it('an appeal with a short reason (under 15 characters)', () =>
      refuse({ as: 'coach', path: '/protests', body: { eventId: D.eventId, reason: 'unfair' }, files: { form: PDF }, table: 'protests' }));
    it('an appeal with a .txt form instead of a PDF', () =>
      refuse({ as: 'coach', path: '/protests', body: { eventId: D.eventId, reason: 'The last basket came after the buzzer.' }, files: { form: TXT }, table: 'protests' }));
    it('an appeal on a game that has not started', () =>
      refuse({ as: 'coach', path: '/protests', body: { eventId: D.notStarted, reason: 'The last basket came after the buzzer.' }, files: { form: PDF }, table: 'protests' }));
    it("an appeal on another college's game", () =>
      refuse({ as: 'coach', path: '/protests', body: { eventId: D.someEvent, reason: 'The last basket came after the buzzer.' }, files: { form: PDF }, table: 'protests' }));
    it('a slide image that is a PDF', () =>
      refuse({ as: 'admin', path: '/admin/site-slides', body: { type: 'carousel', title: 'ERR' }, files: { image: PDF }, table: 'site_slides' }));
    it('a slide link of javascript:alert(1)', () =>
      refuse({ as: 'admin', path: '/admin/site-slides', body: { type: 'carousel', linkUrl: 'javascript:alert(1)' }, files: { image: { name: 's.png', type: 'image/png', bytes: Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex') } }, table: 'site_slides' }));
  });

  /* ── Tryout applications (public) ── */
  describe('Tryout applications (public form)', () => {
    const apply = (over) => ({
      firstName: 'Err', lastName: 'Applicant', email: '99-99999@g.batstate-u.edu.ph', studentId: '99-99999',
      department: CAS, phone: '09171234567', verificationCode: '000000', ...over,
    });
    it('a student ID of "12345" (format 00-00000)', () => refuse({ path: '/tryouts/apply', body: apply({ studentId: '12345' }), table: 'tryout_applications' }));
    it('a phone number of "123"', () => refuse({ path: '/tryouts/apply', body: apply({ phone: '123' }), table: 'tryout_applications' }));
    it('a phone number of letters', () => refuse({ path: '/tryouts/apply', body: apply({ phone: 'call-me-maybe' }), table: 'tryout_applications' }));
    it('a non-BatStateU email', () => refuse({ path: '/tryouts/apply', body: apply({ email: 'someone@gmail.com' }), table: 'tryout_applications' }));
    it('a college that does not exist', () => refuse({ path: '/tryouts/apply', body: apply({ department: 'Hogwarts' }), table: 'tryout_applications' }));
    it('a wrong verification code', () => refuse({ path: '/tryouts/apply', body: apply(), table: 'tryout_applications' }));
  });

  /* ── Accounts and access ── */
  describe('Accounts and access', () => {
    it('changing the password with the wrong current password', () =>
      refuse({ as: 'athlete', method: 'PUT', path: '/account/password', body: { currentPassword: 'wrong-one-123', newPassword: 'New-pass-1234', newPassword_confirmation: 'New-pass-1234' } }));
    it('a new password of 3 characters', () =>
      refuse({ as: 'athlete', method: 'PUT', path: '/account/password', body: { currentPassword: ACCOUNTS.athlete.password, newPassword: 'abc', newPassword_confirmation: 'abc' } }));
    it('a display name of only spaces', () => refuse({ as: 'athlete', method: 'PUT', path: '/account/profile', body: { name: '    ' } }));
    it('a display name of 300 characters', () => refuse({ as: 'athlete', method: 'PUT', path: '/account/profile', body: { name: LONG } }));
    it('the office giving a user a made-up role ("god")', () =>
      refuse({ as: 'admin', method: 'PUT', path: `/admin/users/${query(`App\\Models\\User::where('email', '${ACCOUNTS.judge.email}')->value('id')`)}`, body: { role: 'god' } }));
    it('the office setting a malformed email on a user', () =>
      refuse({ as: 'admin', method: 'PUT', path: `/admin/users/${query(`App\\Models\\User::where('email', '${ACCOUNTS.judge.email}')->value('id')`)}`, body: { email: 'broken@' } }));
    it('a coach setting up a made-up sex category ("Mixed doubles")', () =>
      refuse({ as: 'coach', method: 'PUT', path: '/coach/profile', body: { sports: ['Arnis'], department: CAS, genderCategory: 'Mixed doubles' } }));
    it.skip('[design question] a coach setting up a college that does not exist', () =>
      refuse({ as: 'coach', method: 'PUT', path: '/coach/profile', body: { sports: ['Arnis'], department: 'Hogwarts', genderCategory: 'Men' } }));
    it('joining a team with a code that does not exist', () => refuse({ as: 'athlete', path: '/enroll', body: { enrollmentCode: 'ZZZZZZ' } }));
    it('forwarding an empty list of athletes to the office', () =>
      refuse({ as: 'coach', path: '/cmo/submissions', body: { athleteIds: [] }, table: 'cmo_submissions' }));
    it('an athlete opening the office-only user list', () => refuse({ as: 'athlete', method: 'GET', path: '/admin/users' }));
    it('a request with a forged token', async () => {
      const res = await attempt('/admin/users', { method: 'GET', token: '999|forged-token-value' });
      assert.equal(res.status, 401);
    });
  });
});
