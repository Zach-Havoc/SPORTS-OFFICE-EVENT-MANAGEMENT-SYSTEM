/**
 * The whole system, end to end, the way a season actually runs.
 *
 * One story, step by step, each step in the role that does it:
 *   the office sets up (codes, students, sport, venue, season) → a coach, a
 *   committee member and an athlete sign up with those codes → the coach's
 *   team is set up and the athlete joins → tryouts → CMO documents → a game
 *   is scheduled with a committee → it is scored (as the mobile app does) and
 *   made official → performance, attendance, an appeal with a counter →
 *   a bracket, the site's slideshow, user management, account settings,
 *   the recycle bin, exports and password reset.
 *
 * It creates real records, so it only runs on the throwaway database
 * (`npm run test:e2e:auto`, where mail goes to the log). Accounts it makes
 * use @e2e.sportaxis.test and are deleted at the end; the rest stays in the
 * scratch database until the next run rebuilds it.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { By } from 'selenium-webdriver';
import {
  ACCOUNTS,
  DOWNLOADS,
  attach,
  button,
  cardWith,
  closeDialog,
  count,
  currentPath,
  expectHeading,
  find,
  findText,
  jsClick,
  login,
  loginAs,
  openDialog,
  pageErrors,
  pick,
  selectNative,
  setValue,
  typeInto,
  useBrowser,
  visit,
  waitForPath,
} from '../support/driver.mjs';
import { api, apiToken, databaseName, php, query } from '../support/backend.mjs';

const RUN = Date.now().toString(36).slice(-5);
const DOMAIN = '@e2e.sportaxis.test';
const PASSWORD = `E2e-${RUN}-pass`;
const HOME_COLLEGE = 'College of Informatics and Computing Sciences';
const AWAY_COLLEGE = 'College of Arts and Sciences'; // the suite's own E2E Coach
const SPORT = 'Basketball'; // a sport the demo colleges already have coaches for

/** Everything the story creates, handed from step to step. */
const S = {
  codes: {},
  coach: { email: `coach.${RUN}${DOMAIN}`, name: `Carlo Signup ${RUN}` },
  judge: { email: `judge.${RUN}${DOMAIN}`, name: `Jana Committee ${RUN}` },
  athlete: { email: `athlete.${RUN}${DOMAIN}`, first: 'Rhea', last: `Tester${RUN}`, sr: `98-${String(Date.now()).slice(-5)}` },
  applicant: { first: 'Tomas', last: `Applicant${RUN}`, sr: `97-${String(Date.now() + 7).slice(-5)}` },
  manual: { first: 'Mara', last: `Manual${RUN}`, sr: `96-${String(Date.now() + 3).slice(-5)}` },
  sport: `E2E Sport ${RUN}`,
  venue: `E2E Court ${RUN}`,
  season: `E2E Season ${RUN}`,
  event: `E2E Game ${RUN}`,
  tryout: `E2E Tryouts ${RUN}`,
  training: `E2E Training ${RUN}`,
  slide: `E2E Slide ${RUN}`,
};
S.athlete.name = `${S.athlete.first} ${S.athlete.last}`;

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));


/** Open an athlete's record from the coach's roster (the row's record link). */
async function openAthlete(driver, name) {
  const cell = await findText(driver, name, { tag: 'td' });
  const row = await cell.findElement(By.xpath('./ancestor::tr[1]'));
  const link = await row.findElement(By.xpath(".//a[starts-with(@href, '/coach/athletes/') and not(contains(@href, '/edit'))]"));
  await jsClick(driver, link);
  await expectHeading(driver, name);
}

describe('The whole system, end to end', function () {
  const browser = useBrowser();
  const d = () => browser();

  before(async function () {
    if (process.env.E2E_WRITES !== '1') {
      throw new Error('This test creates records; run it with `npm run test:e2e:auto` (throwaway database).');
    }
    const db = databaseName();
    if (!/e2e|test/.test(db)) throw new Error(`Refusing to write to database "${db}".`);
  });

  after(() => {
    // Accounts made by sign-up use the test domain, so the suite's teardown
    // removes them; say what else was left in the scratch database.
    console.log(`      Run ${RUN}: records left in the scratch database for inspection (event "${S.event}", venue "${S.venue}").`);
  });

  /* ───────────────────────── The office sets up ───────────────────────── */

  describe('1. The Sports Office sets up', () => {
    before(async () => login(d(), 'admin'));

    for (const role of ['coach', 'judge', 'athlete']) {
      it(`generates ${role === 'athlete' ? 'an athlete' : role === 'judge' ? 'a committee' : 'a coach'} registration code`, async () => {
        await visit(d(), '/admin/registration-codes');
        await expectHeading(d(), 'Registration Codes');
        await (await button(d(), 'Generate Code')).click();
        const dialog = await openDialog(d());
        const label = role === 'judge' ? 'Committee -' : `${role[0].toUpperCase()}${role.slice(1)} -`;
        await pick(d(), await dialog.findElement(By.css('[role="combobox"]')), label);
        await typeInto(d(), By.id('label'), `E2E ${role} ${RUN}`);
        await (await button(d(), 'Generate Code', dialog)).click();
        const card = await cardWith(d(), `E2E ${role} ${RUN}`, 'div[@data-slot="card"]');
        S.codes[role] = (await card.findElement(By.css('code')).getText()).trim();
        assert.match(S.codes[role], /\S{4,}/);
      });
    }

    it('imports the registrar list of campus students (CSV)', async () => {
      const csv = path.join(DOWNLOADS, `students-${RUN}.csv`);
      fs.mkdirSync(DOWNLOADS, { recursive: true });
      fs.writeFileSync(
        csv,
        [
          'SR Code,Last Name,First Name,Sex,College,Program,Year Level,Email',
          `${S.athlete.sr},${S.athlete.last},${S.athlete.first},Female,${HOME_COLLEGE},BS Information Technology,2nd Year,${S.athlete.email}`,
          `${S.applicant.sr},${S.applicant.last},${S.applicant.first},Male,${HOME_COLLEGE},BS Computer Science,1st Year,`,
          `${S.manual.sr},${S.manual.last},${S.manual.first},Female,${HOME_COLLEGE},BS Computer Science,1st Year,`,
        ].join('\n'),
      );
      await visit(d(), '/admin/settings');
      await expectHeading(d(), 'System Settings');
      await (await findText(d(), 'Students', { tag: '*[@role="tab"]', exact: true })).click();
      await findText(d(), 'Campus Students');
      await attach(d(), await d().findElement(By.css('input[type="file"][accept*="csv"]')), csv);
      const search = await find(d(), By.css('input[placeholder^="Search SR Code"]'));
      await search.sendKeys(S.athlete.sr);
      await findText(d(), S.athlete.sr);
    });

    it('adds a new sport', async () => {
      await visit(d(), '/admin/settings');
      await (await findText(d(), 'Sports', { tag: '*[@role="tab"]', exact: true })).click();
      await (await button(d(), 'Add Sport')).click();
      await openDialog(d());
      await typeInto(d(), By.id('cat-name'), S.sport);
      await typeInto(d(), By.id('cat-desc'), 'Added by the end-to-end test');
      await (await button(d(), 'Create')).click();
      await findText(d(), S.sport, { tag: 'h3' });
    });

    it('adds a venue for the new sport and basketball', async () => {
      await visit(d(), '/admin/venues');
      await (await button(d(), 'Add Venue')).click();
      const dialog = await openDialog(d());
      await typeInto(d(), By.id('name'), S.venue);
      await selectNative(d(), await d().findElement(By.id('type')), 'Indoor');
      await setValue(d(), await d().findElement(By.id('capacity')), '300');
      await typeInto(d(), By.id('location'), 'Test Building, Ground Floor');
      const sportInput = await dialog.findElement(By.css('input[placeholder^="Type sport name"]'));
      for (const s of [SPORT, S.sport]) {
        await sportInput.sendKeys(s);
        await (await button(d(), 'Add', dialog)).click();
      }
      await (await button(d(), 'Create Venue', dialog)).click();
      await findText(d(), S.venue);
    });

    it('creates the next season (without switching to it)', async () => {
      await visit(d(), '/admin/seasons');
      await typeInto(d(), By.css('input[placeholder="2026–2027 Intramurals"]'), S.season);
      await (await button(d(), 'Create')).click();
      await findText(d(), S.season);
    });
  });

  /* ───────────────────────────── Sign-ups ─────────────────────────────── */

  async function signUp({ email, name, role, roleLabel, code, sr, home }) {
    await visit(d(), '/');
    await d().executeScript('localStorage.clear()');
    await visit(d(), '/login');
    await (await button(d(), "Don't have an account? Create one")).click();
    await expectHeading(d(), 'Create an account');
    await typeInto(d(), By.id('email'), email);
    await typeInto(d(), By.id('name'), name);
    const roleBox = await d().findElement(By.xpath("//label[@for='role']/following-sibling::button[@role='combobox']"));
    await pick(d(), roleBox, roleLabel);
    if (sr) await typeInto(d(), By.id('srCode'), sr);
    await typeInto(d(), By.id('registrationCode'), code);
    await typeInto(d(), By.id('password'), PASSWORD);
    await typeInto(d(), By.id('confirmPassword'), PASSWORD);
    await jsClick(d(), await d().findElement(By.id('privacyAccepted')));
    await (await find(d(), By.css('form button[type="submit"]'))).click();
    // Back on the sign-in form, with a note that the account exists.
    await findText(d(), 'Account created. Sign in with your email');
    assert.equal(query(`App\\Models\\User::where('email', '${email}')->value('role')`), role);
    await loginAs(d(), email, PASSWORD, home, { fresh: true });
  }

  describe('2. People sign up with the codes', () => {
    it('a coach signs up with the coach code', async () => {
      await signUp({ ...S.coach, role: 'coach', roleLabel: 'Coach -', code: S.codes.coach, home: '/coach' });
    });

    it('a committee member signs up with the committee code', async () => {
      await signUp({ ...S.judge, role: 'judge', roleLabel: 'Committee -', code: S.codes.judge, home: '/judge' });
    });

    it('an athlete signs up with the athlete code, verified against the registrar list', async () => {
      await signUp({
        email: S.athlete.email, name: S.athlete.name, role: 'athlete', roleLabel: 'Athlete -',
        code: S.codes.athlete, sr: S.athlete.sr, home: '/athlete',
      });
    });

    it('a used code cannot be used again', async () => {
      await visit(d(), '/');
      await d().executeScript('localStorage.clear()');
      await visit(d(), '/login');
      await (await button(d(), "Don't have an account? Create one")).click();
      await typeInto(d(), By.id('email'), `again.${RUN}${DOMAIN}`);
      await typeInto(d(), By.id('name'), 'Second Try');
      await pick(d(), await d().findElement(By.xpath("//label[@for='role']/following-sibling::button[@role='combobox']")), 'Coach -');
      await typeInto(d(), By.id('registrationCode'), S.codes.coach);
      await typeInto(d(), By.id('password'), PASSWORD);
      await typeInto(d(), By.id('confirmPassword'), PASSWORD);
      await jsClick(d(), await d().findElement(By.id('privacyAccepted')));
      await (await find(d(), By.css('form button[type="submit"]'))).click();
      const alert = await find(d(), By.css('form [role="alert"]'));
      assert.match(await alert.getText(), /invalid|expired/i);
      assert.equal(await currentPath(d()), '/login');
    });
  });

  /* ─────────────────────────── The team forms ─────────────────────────── */

  describe('3. The coach’s team forms', () => {
    it('the office assigns the new coach to a college', async () => {
      await login(d(), 'admin');
      await visit(d(), '/admin/coaches');
      await expectHeading(d(), 'Coach Management');
      const card = await cardWith(d(), S.coach.name, 'div[@data-slot="card"]');
      await jsClick(d(), await card.findElement(By.xpath(".//button[normalize-space(.)='Assign College']")));
      const dialog = await openDialog(d());
      await pick(d(), await dialog.findElement(By.css('[role="combobox"]')), HOME_COLLEGE, { exact: true });
      await (await button(d(), 'Save', dialog)).click();
      await d().wait(async () => query(`App\\Models\\User::where('email', '${S.coach.email}')->value('department')`) === HOME_COLLEGE, 15000);
    });

    it('a college can have only one coach per sport, and the coach is told why', async () => {
      await loginAs(d(), S.coach.email, PASSWORD, '/coach');
      await visit(d(), '/coach/athletes');
      await (await button(d(), 'Set Up Sports')).click();
      const dialog = await openDialog(d());
      const boxes = await dialog.findElements(By.css('[role="combobox"]'));
      await pick(d(), boxes[0], HOME_COLLEGE, { exact: true });
      await (await button(d(), SPORT, dialog)).click(); // the demo college already has one
      await pick(d(), boxes[1], "Men & Women's", { exact: true });
      await (await button(d(), 'Save', dialog)).click();
      const alert = await find(d(), By.css('[role="dialog"] [role="alert"]'));
      await d().wait(async () => /already has a coach/.test(await alert.getText()), 10000);
      await (await button(d(), SPORT, dialog)).click(); // unselect it again
    });

    it('the coach takes the sport the office added, and gets a team code', async () => {
      const dialog = await openDialog(d());
      await (await button(d(), S.sport, dialog)).click();
      await (await button(d(), 'Save', dialog)).click();
      await expectHeading(d(), `${S.sport} Team`);
      const code = await find(d(), By.xpath("//p[normalize-space(.)='Enrollment Code']/following-sibling::p"));
      S.teamCode = (await code.getText()).trim();
      assert.ok(S.teamCode.length >= 4);
    });

    it('the athlete joins the team with the code', async () => {
      await loginAs(d(), S.athlete.email, PASSWORD, '/athlete');
      await typeInto(d(), By.css('input[placeholder="e.g. AB1CD2"]'), S.teamCode);
      await (await button(d(), 'Join Team')).click();
      await d().wait(async () => query(`App\\Models\\User::where('email', '${S.athlete.email}')->value('coach_id')`) !== null, 15000);
      await visit(d(), '/athlete/team');
      await findText(d(), S.coach.name);
    });

    it('the coach sees the athlete on the roster and opens their record', async () => {
      await loginAs(d(), S.coach.email, PASSWORD, '/coach');
      await visit(d(), '/coach/athletes');
      await openAthlete(d(), S.athlete.name);
      for (const t of ['Attendance', 'Requirements']) {
        await (await find(d(), By.xpath(`//main//button[starts-with(normalize-space(.), '${t}')]`))).click();
      }
    });

    it('the coach adds an athlete by hand', async () => {
      await visit(d(), '/coach/athletes/new');
      await typeInto(d(), By.id('studentId'), S.manual.sr);
      await typeInto(d(), By.id('firstName'), S.manual.first);
      await typeInto(d(), By.id('lastName'), S.manual.last);
      await typeInto(d(), By.id('email'), `manual.${RUN}${DOMAIN}`);
      const boxes = await d().findElements(By.css('main form [role="combobox"]'));
      for (const box of boxes) {
        if ((await box.getText()).includes('Select college')) await pick(d(), box, HOME_COLLEGE, { exact: true });
      }
      await typeInto(d(), By.id('course'), 'BS Computer Science');
      await typeInto(d(), By.id('emergencyContactName'), 'Parent Manual');
      await typeInto(d(), By.id('emergencyContactPhone'), '09170000000');
      await (await button(d(), 'Add Athlete')).click();
      await waitForPath(d(), '/coach/athletes', 20000);
      await findText(d(), `${S.manual.first} ${S.manual.last}`);
    });

    it('the coach edits an athlete’s roster details', async () => {
      await openAthlete(d(), `${S.manual.first} ${S.manual.last}`);
      await (await find(d(), By.xpath("//main//a[normalize-space(.)='Edit'] | //main//button[normalize-space(.)='Edit']"))).click();
      await expectHeading(d(), 'Athlete Details');
      await typeInto(d(), By.id('jerseyNumber'), '23');
      await (await button(d(), 'Save Roster Details')).click();
      await d().wait(async () => !(await currentPath(d())).endsWith('/edit'), 20000);
      await d().wait(
        async () => String(query(`App\\Models\\Athlete::where('student_id', '${S.manual.sr}')->value('jersey_number')`)) === '23',
        15000,
      );
    });
  });

  /* ────────────────────────────── Tryouts ─────────────────────────────── */

  describe('4. Tryouts', () => {
    it('the coach posts a tryout announcement', async () => {
      await visit(d(), '/coach/announcements');
      await (await button(d(), 'New Announcement')).click();
      const dialog = await openDialog(d());
      await typeInto(d(), By.id('title'), S.tryout);
      await typeInto(d(), By.id('sport'), S.sport);
      const toggle = await dialog.findElement(By.css('button[role="switch"]#isTryout'));
      // New announcements start as tryouts; make sure it's on.
      if ((await toggle.getAttribute('aria-checked')) !== 'true') await toggle.click();
      await d().wait(async () => (await toggle.getAttribute('aria-checked')) === 'true', 5000);
      const tomorrow = new Date(Date.now() + 86400000);
      await setValue(d(), await find(d(), By.css('[role="dialog"] input[aria-label="Tryout date"]')), ymd(tomorrow));
      await setValue(d(), await find(d(), By.css('[role="dialog"] input[aria-label="Starts"]')), '16:00');
      await setValue(d(), await find(d(), By.css('[role="dialog"] input[aria-label="Ends"]')), '18:00');
      await (await find(d(), By.css('[role="dialog"] input[aria-label="Venue"]'))).sendKeys(S.venue);
      await typeInto(d(), By.id('content'), 'Open to all CICS students. Bring your PE uniform.');
      await (await button(d(), 'Create Announcement', dialog)).click();
      await findText(d(), S.tryout);
    });

    it('a student applies from the public announcements page, verifying their email', async () => {
      await visit(d(), '/');
      await d().executeScript('localStorage.clear()');
      await visit(d(), '/announcements');
      await expectHeading(d(), 'Announcements');
      await (await find(d(), By.css('input[aria-label="Search announcements"]'))).sendKeys(S.tryout);
      await (await button(d(), 'Apply for Tryout')).click();
      const dialog = await openDialog(d());
      const email = `${S.applicant.sr}@g.batstate-u.edu.ph`;
      await typeInto(d(), By.id('firstName'), S.applicant.first);
      await typeInto(d(), By.id('lastName'), S.applicant.last);
      await typeInto(d(), By.id('studentId'), S.applicant.sr);
      await selectNative(d(), await dialog.findElement(By.id('yearLevel')), '1st Year');
      const dept = await dialog.findElement(By.id('department'));
      if (await dept.isEnabled()) await pick(d(), dept, HOME_COLLEGE, { exact: true });
      await typeInto(d(), By.id('phone'), '09171234567');
      await typeInto(d(), By.id('email'), email);
      await (await button(d(), 'Send Verification Code', dialog)).click();
      await find(d(), By.id('verificationCode'));
      // The code was emailed (to the log here); read it where the app keeps it.
      const code = query(`DB::table('email_verifications')->where('email', '${email}')->value('code')`);
      assert.match(String(code), /^\d{6}$/);
      await typeInto(d(), By.id('verificationCode'), String(code));
      await (await button(d(), 'Submit Application')).click();
      await findText(d(), 'Application Submitted!');
    });

    it('the coach accepts the applicant, who joins the roster', async () => {
      await loginAs(d(), S.coach.email, PASSWORD, '/coach');
      await visit(d(), '/coach/tryouts');
      await expectHeading(d(), 'Tryout Applicants');
      const card = await cardWith(d(), S.applicant.last, 'div[contains(@class,"rounded-lg")]');
      await jsClick(d(), await card.findElement(By.xpath(".//button[normalize-space(.)='Accept']")));
      const dialog = await openDialog(d());
      await (await dialog.findElement(By.css('textarea'))).sendKeys('First practice is Monday, 4 PM.');
      await (await button(d(), 'Accept and add to roster', dialog)).click();
      await d().wait(async () => query(`App\\Models\\Athlete::where('student_id', '${S.applicant.sr}')->count()`) === 1, 15000);
      await visit(d(), '/coach/athletes');
      await findText(d(), S.applicant.last);
    });
  });

  /* ────────────────────────── CMO requirements ────────────────────────── */

  describe('5. CMO requirements, athlete → coach → office', () => {
    it('the athlete uploads every required document', async () => {
      await loginAs(d(), S.athlete.email, PASSWORD, '/athlete');
      await visit(d(), '/athlete/requirements');
      await expectHeading(d(), 'My CMO Requirements');
      const required = query("App\\Models\\RequirementType::where('required', true)->where('active', true)->count()");
      assert.ok(required > 0, 'the checklist has required documents');
      for (let i = 0; i < required; i++) {
        const section = await cardWith(d(), 'Required Documents', 'div[@data-slot="card"]');
        await jsClick(d(), await button(d(), 'Submit', section));
        const dialog = await openDialog(d());
        // A checklist item comes with its name; only a free-form document asks for one.
        const name = await dialog.findElements(By.id('name'));
        if (name.length && !(await name[0].getAttribute('value'))) await name[0].sendKeys(`Document ${i + 1}`);
        await (await dialog.findElement(By.id('description'))).sendKeys('Scanned copy.');
        await attach(d(), await dialog.findElement(By.id('file')), 'document.pdf');
        await (await button(d(), 'Submit', dialog)).click();
        await d().wait(async () => (await count(d(), By.css('[role="dialog"]'))) === 0, 20000);
      }
      const athleteId = query(`App\\Models\\Athlete::where('user_id', App\\Models\\User::where('email', '${S.athlete.email}')->value('id'))->value('id') ?? App\\Models\\User::where('email', '${S.athlete.email}')->value('id')`);
      S.athleteId = athleteId;
      assert.equal(query(`App\\Models\\Requirement::where('athlete_id', '${athleteId}')->where('status', 'pending')->count()`), required);
    });

    it('the coach reviews and approves each document', async () => {
      await loginAs(d(), S.coach.email, PASSWORD, '/coach');
      await visit(d(), '/coach/requirements');
      await expectHeading(d(), 'CMO Requirements');
      for (;;) {
        const pending = query(`App\\Models\\Requirement::where('athlete_id', '${S.athleteId}')->where('status', 'pending')->count()`);
        if (pending === 0) break;
        const review = await find(d(), By.xpath(
          `//button[normalize-space(.)='Review'][ancestor::div[contains(@class,'rounded-lg')][1][contains(., '${S.athlete.name}')]]`,
        ));
        await jsClick(d(), review);
        const dialog = await openDialog(d());
        await (await button(d(), 'Approve', dialog)).click();
        await d().wait(async () => query(`App\\Models\\Requirement::where('athlete_id', '${S.athleteId}')->where('status', 'pending')->count()`) < pending, 15000);
        await d().wait(async () => (await count(d(), By.css('[role="dialog"]'))) === 0, 15000);
      }
    });

    it('the coach forwards the cleared athlete to the office', async () => {
      await visit(d(), '/coach/requirements');
      await findText(d(), 'Forward to the Sports Office');
      const box = await find(d(), By.css(`button[aria-label="Forward ${S.athlete.name}"]`));
      if ((await box.getAttribute('aria-checked')) !== 'true') await jsClick(d(), box);
      const forward = await find(d(), By.xpath("//button[starts-with(normalize-space(.), 'Forward ') and contains(., 'to the office')]"));
      await jsClick(d(), forward);
      await d().wait(async () => query(`App\\Models\\CmoSubmissionAthlete::where('athlete_id', '${S.athleteId}')->value('status')`) === 'submitted', 15000);
    });

    it('the office accepts the athlete on the college & sport board', async () => {
      await login(d(), 'admin');
      await visit(d(), '/admin/requirements');
      await expectHeading(d(), 'CMO Requirements');
      const name = await findText(d(), S.athlete.name);
      const row = await name.findElement(By.xpath('./ancestor::li[1]'));
      const accept = await row.findElements(By.xpath(".//button[normalize-space(.)='Accept']"));
      if (accept.length) {
        await jsClick(d(), accept[0]);
      } else {
        // The redesigned board reviews in a side panel.
        await jsClick(d(), await row.findElement(By.xpath(".//button[normalize-space(.)='Review']")));
        await (await button(d(), 'Accept', await openDialog(d()))).click();
      }
      await d().wait(async () => query(`App\\Models\\CmoSubmissionAthlete::where('athlete_id', '${S.athleteId}')->value('status')`) === 'accepted', 15000);
    });

    it('the office queue shows the forwarded batch', async () => {
      await visit(d(), '/admin/transactions');
      await expectHeading(d(), 'Transactions');
      await (await button(d(), 'All')).click();
      await findText(d(), 'CMO-');
    });

    it('the coach is notified of the decision', async () => {
      await loginAs(d(), S.coach.email, PASSWORD, '/coach');
      const bell = await find(d(), By.css('header button[aria-label^="Notifications"]'));
      assert.match(await bell.getAttribute('aria-label'), /unread/);
      await bell.click();
      await findText(d(), S.athlete.first);
      await d().actions().sendKeys('').perform();
    });
  });

  /* ───────────────────── A game, its committee and score ───────────────────── */

  describe('6. A game is scheduled, scored and made official', () => {
    it('the office creates the game in four parts, with the new committee member', async () => {
      await login(d(), 'admin');
      await visit(d(), '/admin/events');
      await expectHeading(d(), 'Sports Event Management');
      await (await button(d(), 'New Event')).click();
      let dialog = await openDialog(d());

      await typeInto(d(), By.css('[role="dialog"] input[placeholder^="e.g. Men"]'), S.event);
      await pick(d(), (await dialog.findElements(By.css('[role="combobox"]')))[0], S.sport, { exact: true });
      await (await button(d(), 'Continue', dialog)).click();

      dialog = await openDialog(d());
      const sides = await dialog.findElements(By.css('[role="combobox"]'));
      await pick(d(), sides[0], HOME_COLLEGE, { exact: true });
      await pick(d(), (await dialog.findElements(By.css('[role="combobox"]')))[1], AWAY_COLLEGE, { exact: true });
      await (await button(d(), 'Continue', dialog)).click();

      // Started an hour ago, so it can be scored and protested now.
      const now = new Date();
      const start = new Date(Math.max(now.getTime() - 3600000, new Date(now).setHours(0, 5, 0, 0)));
      const end = new Date(Math.min(now.getTime() + 3600000, new Date(now).setHours(23, 55, 0, 0)));
      S.eventDate = ymd(now);
      dialog = await openDialog(d());
      await setValue(d(), await dialog.findElement(By.css('input[type="date"]')), S.eventDate);
      const times = await dialog.findElements(By.css('input[type="time"]'));
      await setValue(d(), times[0], hm(start));
      await setValue(d(), times[1], hm(end));
      await pick(d(), await dialog.findElement(By.css('[role="combobox"]')), S.venue);
      await (await button(d(), 'Continue', dialog)).click();

      dialog = await openDialog(d());
      const judgeId = query(`App\\Models\\User::where('email', '${S.judge.email}')->value('id')`);
      await jsClick(d(), await dialog.findElement(By.css(`label[for="judge-${judgeId}"]`)));
      await (await button(d(), 'Create Event', dialog)).click();
      await d().wait(async () => query(`App\\Models\\Event::where('name', '${S.event}')->count()`) === 1, 20000);
      S.eventId = query(`App\\Models\\Event::where('name', '${S.event}')->value('id')`);
      await d().wait(async () => (await count(d(), By.css('[role="dialog"]'))) === 0, 15000);
    });

    it('the game is on the public schedule and the committee member’s panel', async () => {
      await visit(d(), '/');
      await d().executeScript('localStorage.clear()');
      await visit(d(), `/`);
      await expectHeading(d(), 'Match Schedule');
      await loginAs(d(), S.judge.email, PASSWORD, '/judge');
      await expectHeading(d(), 'Committee Panel');
      await findText(d(), RUN);
      assert.ok(query(`App\\Models\\Event::find('${S.eventId}')->isScorableBy(App\\Models\\User::where('email', '${S.judge.email}')->first())`));
    });

    it('the committee scores it live (as the mobile app does) and the public live board shows it', async () => {
      S.judgeToken = await apiToken(S.judge.email, PASSWORD);
      await api(`/events/${S.eventId}/live`, { method: 'PUT', token: S.judgeToken, body: { homeScore: 10, awayScore: 8, status: 'in_progress', method: 'live' } });
      assert.equal(query(`App\\Models\\Event::find('${S.eventId}')->status`), 'ongoing');
      await visit(d(), '/live');
      await expectHeading(d(), 'Live Scores');
      await d().wait(async () => (await count(d(), By.xpath("//main//*[normalize-space(.)='10']"))) > 0, 30000, 'live score 10 not shown');
    });

    it('the committee finalises the game and submits the final scores', async () => {
      await api(`/events/${S.eventId}/live`, { method: 'PUT', token: S.judgeToken, body: { homeScore: 21, awayScore: 15, status: 'final' } });
      for (const [department, totalScore] of [[HOME_COLLEGE, 21], [AWAY_COLLEGE, 15]]) {
        await api('/scores', { method: 'POST', token: S.judgeToken, body: { eventId: S.eventId, department, totalScore } });
      }
      assert.equal(query(`App\\Models\\Event::find('${S.eventId}')->status`), 'completed');
    });

    it('the office makes the result official in Reports', async () => {
      await login(d(), 'admin');
      await visit(d(), '/admin/reports');
      await expectHeading(d(), 'Reports & Results');
      await (await find(d(), By.css('input[placeholder="Search events or colleges"]'))).sendKeys(S.event);
      await jsClick(d(), await findText(d(), S.event, { tag: 'button' }));
      await jsClick(d(), await button(d(), 'Mark official'));
      await findText(d(), 'Result is official');
      assert.equal(query(`App\\Models\\Score::where('event_id', '${S.eventId}')->where('status', '!=', 'official')->count()`), 0);
    });

    it('the result appears in the public event history', async () => {
      await visit(d(), '/history');
      await expectHeading(d(), 'Event History');
      await findText(d(), RUN);
    });
  });

  /* ───────────────── Coaching: performance and attendance ───────────────── */

  describe('7. Coaching records', () => {
    it('the coach records the athlete’s performance in the game', async () => {
      await loginAs(d(), S.coach.email, PASSWORD, '/coach');
      await visit(d(), '/coach/performance');
      await (await button(d(), 'Record Performance')).click();
      const dialog = await openDialog(d());
      await selectNative(d(), await dialog.findElement(By.id('athleteId')), S.athlete.name);
      await selectNative(d(), await dialog.findElement(By.id('eventId')), RUN);
      await setValue(d(), await dialog.findElement(By.id('overallRating')), '8');
      await typeInto(d(), By.id('coachNotes'), 'Strong defence, good court vision.');
      await (await button(d(), 'Record Performance', dialog)).click();
      await d().wait(async () => (await count(d(), By.css('[role="dialog"]'))) === 0, 15000);
      await findText(d(), S.athlete.name);
    });

    it('the coach schedules a training session and takes attendance', async () => {
      await visit(d(), '/coach/attendance');
      await typeInto(d(), By.css('input[placeholder="e.g. Team training"]'), S.training);
      const today = new Date();
      await setValue(d(), await d().findElement(By.css('main input[type="date"]')), ymd(today));
      const times = await d().findElements(By.css('main input[type="time"]'));
      await setValue(d(), times[0], '17:00');
      await setValue(d(), times[1], '19:00');
      await (await button(d(), 'Create session')).click();
      await jsClick(d(), await findText(d(), S.training, { tag: 'p' }));
      const dialog = await openDialog(d());
      const row = await (await findText(d(), S.athlete.name)).findElement(By.xpath('./ancestor::*[.//select][1]'));
      await selectNative(d(), await row.findElement(By.css('select')), 'Present');
      await d().wait(async () => (await count(d(), By.xpath("//*[@role='dialog']//*[contains(., 'Saved')]"))) > 0, 15000);
      await closeDialog(d());
    });

    it('the athlete sees the performance record and the attendance', async () => {
      await loginAs(d(), S.athlete.email, PASSWORD, '/athlete');
      await visit(d(), '/athlete/performance');
      await expectHeading(d(), 'My Performance');
      await findText(d(), 'Strong defence');
      await visit(d(), '/athlete/attendance');
      await expectHeading(d(), 'My Attendance');
      await findText(d(), S.training);
    });
  });

  /* ─────────────────────── An appeal with a counter ─────────────────────── */

  describe('8. An appeal, a counter and a decision', () => {
    it('the coach files an appeal on the game with the formal form (PDF)', async () => {
      await loginAs(d(), S.coach.email, PASSWORD, '/coach');
      await visit(d(), '/coach/protests');
      await expectHeading(d(), 'Appeals');
      await pick(d(), await find(d(), By.css('button[aria-label="Game"]')), RUN);
      await typeInto(d(), By.css('textarea[placeholder^="What went wrong"]'), 'The last basket came after the buzzer and should not count.');
      await attach(d(), await d().findElement(By.css('main input[type="file"]')), 'document.pdf');
      await (await button(d(), 'Submit appeal')).click();
      await d().wait(async () => query(`App\\Models\\Protest::where('event_id', '${S.eventId}')->value('status')`) === 'open', 15000);
    });

    it('the office asks the other college for a counter', async () => {
      await login(d(), 'admin');
      await visit(d(), '/admin/protests');
      await jsClick(d(), await button(d(), `Ask ${AWAY_COLLEGE} for a counter (12h)`));
      await d().wait(async () => query(`App\\Models\\Protest::where('event_id', '${S.eventId}')->value('status')`) === 'awaiting_counter', 15000);
    });

    it('the other college’s coach files the counter (PDF)', async () => {
      await login(d(), 'coach'); // the suite's E2E Coach, from the away college
      await visit(d(), '/coach/protests');
      await find(d(), By.css('h2#counters'));
      await typeInto(d(), By.css('textarea[placeholder^="Your side"]'), 'The referee signalled the basket before the buzzer sounded.');
      const inputs = await d().findElements(By.css('main input[type="file"]'));
      await attach(d(), inputs[0], 'document.pdf');
      await (await button(d(), 'Submit counter')).click();
      await d().wait(async () => query(`App\\Models\\Protest::where('event_id', '${S.eventId}')->value('counter_filed_at')`) !== null, 15000);
    });

    it('the office decides, and the coach sees the decision', async () => {
      await login(d(), 'admin');
      await visit(d(), '/admin/protests');
      await jsClick(d(), await button(d(), 'Review & resolve'));
      await (await button(d(), 'Dismiss')).click();
      await typeInto(d(), By.css('textarea[placeholder^="What did you find"]'), 'Video review shows the shot left the hand before the buzzer. The result stands.');
      await (await button(d(), 'Save decision')).click();
      await d().wait(async () => query(`App\\Models\\Protest::where('event_id', '${S.eventId}')->value('status')`) === 'dismissed', 15000);
      await loginAs(d(), S.coach.email, PASSWORD, '/coach');
      await visit(d(), '/coach/protests');
      await findText(d(), 'The result stands');
    });
  });

  /* ───────────────────── Brackets and the public site ───────────────────── */

  describe('9. A bracket for the new sport', () => {
    it('the office generates and publishes a round-robin bracket', async () => {
      await login(d(), 'admin');
      await visit(d(), '/admin/bracketing');
      await expectHeading(d(), 'Automatic Bracketing');
      await selectNative(d(), await find(d(), By.id('sport')), S.sport);
      await jsClick(d(), await button(d(), 'Round robin'));
      await jsClick(d(), await button(d(), 'All'));
      await setValue(d(), await d().findElement(By.id('startDate')), ymd(new Date(Date.now() + 2 * 86400000)));
      await setValue(d(), await d().findElement(By.id('startTime')), '08:00');
      await selectNative(d(), await d().findElement(By.id('venue')), S.venue);
      await jsClick(d(), await button(d(), 'Generate bracket'));
      await jsClick(d(), await find(d(), By.xpath("//button[starts-with(normalize-space(.), 'Save & Publish')]")));
      await d().wait(async () => query(`DB::table('brackets')->where('sport', '${S.sport}')->count()`) > 0, 30000);
    });

    it('the bracket is on the public brackets page and opens', async () => {
      await visit(d(), '/brackets');
      await expectHeading(d(), 'Tournament Brackets');
      await jsClick(d(), await find(d(), By.xpath(`//a[starts-with(@href, '/bracket/')][contains(., '${S.sport}')]`)));
      await d().wait(async () => (await currentPath(d())).startsWith('/bracket/'), 15000);
      await findText(d(), 'Round 1');
    });
  });

  describe('10. Site content', () => {
    it('the office adds a slide to the schedule page slideshow', async () => {
      await visit(d(), '/admin/carousel');
      await expectHeading(d(), 'Site Content');
      await (await button(d(), 'Add slide')).click();
      await attach(d(), await d().findElement(By.css('input[type="file"]')), 'slide.png');
      await typeInto(d(), By.css('input[placeholder="e.g. Opening Ceremony"]'), S.slide);
      await (await button(d(), 'Save')).click();
      await findText(d(), S.slide);
    });
  });

  /* ─────────────────────────── Accounts ─────────────────────────── */

  describe('11. Users and accounts', () => {
    it('a disabled account cannot sign in; enabling it again restores access', async () => {
      await visit(d(), '/admin/users');
      await expectHeading(d(), 'User Management');
      const search = await find(d(), By.css('input[placeholder="Search by name or email"]'));
      await search.sendKeys(S.athlete.email);
      await findText(d(), S.athlete.email);
      await jsClick(d(), await find(d(), By.css(`button[aria-label="Disable ${query(`App\\Models\\User::where('email', '${S.athlete.email}')->value('name')`)}"]`)));
      await (await button(d(), 'Disable', await find(d(), By.css('[role="alertdialog"]')))).click();
      await d().wait(async () => query(`App\\Models\\User::where('email', '${S.athlete.email}')->value('active')`) == false, 15000);

      await loginAs(d(), S.athlete.email, PASSWORD);
      const alert = await find(d(), By.css('form [role="alert"]'));
      assert.match(await alert.getText(), /disabled/i);

      await login(d(), 'admin');
      await visit(d(), '/admin/users');
      await (await find(d(), By.css('input[placeholder="Search by name or email"]'))).sendKeys(S.athlete.email);
      await findText(d(), S.athlete.email);
      await jsClick(d(), await find(d(), By.css('button[aria-label^="Enable "]')));
      await (await button(d(), 'Enable', await find(d(), By.css('[role="alertdialog"]')))).click();
      await d().wait(async () => query(`App\\Models\\User::where('email', '${S.athlete.email}')->value('active')`) == true, 15000);
      await loginAs(d(), S.athlete.email, PASSWORD, '/athlete', { fresh: true });
    });

    it('the coach changes their display name and password, then signs in with the new one', async () => {
      await loginAs(d(), S.coach.email, PASSWORD, '/coach');
      await visit(d(), '/settings/account');
      await expectHeading(d(), 'Account Settings');
      await typeInto(d(), By.id('name'), `Carlo Renamed ${RUN}`);
      await (await button(d(), 'Save Name')).click();
      await d().wait(async () => query(`App\\Models\\User::where('email', '${S.coach.email}')->value('name')`) === `Carlo Renamed ${RUN}`, 15000);
      const next = `${PASSWORD}-2`;
      await typeInto(d(), By.id('current-pw'), PASSWORD);
      await typeInto(d(), By.id('new-pw'), next);
      await typeInto(d(), By.id('confirm-pw'), next);
      await (await button(d(), 'Update Password')).click();
      await d().wait(async () => php(`echo Hash::check('${next}', App\\Models\\User::where('email', '${S.coach.email}')->value('password')) ? 'yes' : 'no';`) === 'yes', 15000);
      await loginAs(d(), S.coach.email, next, '/coach', { fresh: true });
      S.coachPassword = next;
    });

    it('forgot password: a reset is sent for a known email', async () => {
      await visit(d(), '/');
      await d().executeScript('localStorage.clear()');
      await visit(d(), '/login');
      await (await button(d(), 'Forgot password?')).click();
      await typeInto(d(), By.id('email'), S.judge.email);
      await (await find(d(), By.css('form button[type="submit"]'))).click();
      await findText(d(), 'Password reset instructions have been sent');
    });
  });

  /* ───────────────────── Recovery, exports and errors ───────────────────── */

  describe('12. Recycle bin and exports', () => {
    it('a deleted game goes to the recycle bin and can be restored', async () => {
      await login(d(), 'admin');
      await visit(d(), '/admin/events');
      await (await find(d(), By.css('input[placeholder^="Search by name or sport"]'))).sendKeys(S.event);
      const card = await cardWith(d(), S.event, 'div[@data-slot="card"]');
      await jsClick(d(), await card.findElement(By.css('button.text-red-600')));
      await (await button(d(), 'Delete Event', await openDialog(d()))).click();
      await d().wait(async () => query(`App\\Models\\Event::find('${S.eventId}')`) === null, 15000);

      await visit(d(), '/admin/trash');
      await expectHeading(d(), 'Recovery & Audit');
      const item = await cardWith(d(), S.event, '*[self::li or self::div][.//button]');
      await jsClick(d(), await item.findElement(By.xpath(".//button[normalize-space(.)='Restore']")));
      await d().wait(async () => query(`App\\Models\\Event::find('${S.eventId}')?->id`) === S.eventId, 15000);
    });

    it('the college standings export as a CSV file', async () => {
      const before = fs.existsSync(DOWNLOADS) ? fs.readdirSync(DOWNLOADS).filter((f) => f.endsWith('.csv')).length : 0;
      await visit(d(), '/admin/reports');
      await expectHeading(d(), 'Reports & Results');
      await jsClick(d(), await button(d(), 'CSV'));
      await d().wait(async () => fs.readdirSync(DOWNLOADS).filter((f) => f.endsWith('.csv') && !f.endsWith('.crdownload')).length > before, 20000, 'no CSV downloaded');
    });

    it('no page showed a script error along the way', async () => {
      assert.deepEqual(await pageErrors(d()), []);
    });
  });
});
