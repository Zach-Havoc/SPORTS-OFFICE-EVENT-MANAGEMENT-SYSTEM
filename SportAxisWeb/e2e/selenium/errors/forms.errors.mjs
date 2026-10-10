/**
 * Error catcher, part 2: what a person sees when they type something wrong.
 *
 * Selenium fills the real forms with invalid input (impossible dates and
 * times, out-of-range numbers, wrong files, mistyped codes, odd characters)
 * and checks that the form either stops it or explains why, that nothing
 * is saved, and that the page doesn't crash. A form that silently does
 * nothing fails: pop-up messages are switched off on this site, so the
 * reason has to be on the page.
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
  closeDialog,
  count,
  currentPath,
  expectHeading,
  find,
  findText,
  jsClick,
  login,
  openDialog,
  pageErrors,
  pick,
  setValue,
  typeInto,
  useBrowser,
  visit,
} from '../support/driver.mjs';
import { databaseName, query } from '../support/backend.mjs';

const RUN = Date.now().toString(36).slice(-5);
const LONG = 'x'.repeat(300);
const rows = (table, where = '') => query(`DB::table('${table}')${where}->count()`);

/**
 * The reason the page gives, inside `scope` (a dialog or form): the
 * browser's own "please fill out / value must be ≥ 1" check, or a visible
 * error message. null when the page says nothing.
 */
async function reason(driver, scope) {
  return driver.executeScript(
    `const root = arguments[0] || document;
     const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
     const blocked = [...root.querySelectorAll('input, select, textarea')].find((el) => !el.disabled && !el.checkValidity());
     if (blocked) return 'browser: ' + blocked.validationMessage;
     const msgs = [...root.querySelectorAll('[role="alert"], [class*="text-red-"], [class*="text-danger"], [class*="text-destructive"], [data-slot="form-message"]')]
       .filter((el) => visible(el) && !el.closest('button, label') && el.tagName !== 'BUTTON')
       .map((el) => el.textContent.trim())
       .filter((t) => t.length > 3); // not the "*" of a required label
     return msgs[0] || null;`,
    scope ?? null,
  );
}

/** After a refused submit: a reason is shown, and the page is still alive. */
async function expectReason(driver, scope, pattern) {
  let said = null;
  await driver
    .wait(async () => (said = await reason(driver, scope)), 10000)
    .catch(() => {});
  assert.ok(said, 'The form gave no reason (nothing on the page explains what is wrong).');
  if (pattern) assert.match(said, pattern);
  assert.deepEqual(await pageErrors(driver), [], 'the page crashed');
  return said;
}

describe('Error catcher — forms refuse bad input and say why', function () {
  const browser = useBrowser();
  const d = () => browser();

  before(function () {
    if (process.env.E2E_WRITES !== '1') throw new Error('Run with `npm run test:e2e:auto` (throwaway database).');
    if (!/e2e|test/.test(databaseName())) throw new Error('Refusing to run outside the throwaway database.');
  });

  /* ── Sign in / sign up ── */
  describe('Sign in and sign up', () => {
    beforeEach(async () => {
      await visit(d(), '/');
      await d().executeScript('localStorage.clear()');
      await visit(d(), '/login');
    });

    it('sign in with both fields empty', async () => {
      await (await find(d(), By.css('form button[type="submit"]'))).click();
      await expectReason(d(), await find(d(), By.css('form')), /^browser:/);
      assert.equal(await currentPath(d()), '/login');
    });

    it('sign in with "abc" as the email', async () => {
      await typeInto(d(), By.id('email'), 'abc');
      await typeInto(d(), By.id('password'), 'whatever1');
      await (await find(d(), By.css('form button[type="submit"]'))).click();
      await expectReason(d(), await find(d(), By.css('form')), /^browser:/);
    });

    const signUp = async ({ password = 'Valid-pass-123', confirm = password, code = 'NOPE-0000', privacy = true, role = 'Coach -', sr }) => {
      await (await button(d(), "Don't have an account? Create one")).click();
      await typeInto(d(), By.id('email'), `ui.${RUN}.${Math.random().toString(36).slice(2, 6)}@e2e.sportaxis.test`);
      await typeInto(d(), By.id('name'), 'Ui Tester');
      await pick(d(), await d().findElement(By.xpath("//label[@for='role']/following-sibling::button[@role='combobox']")), role);
      if (sr !== undefined) await typeInto(d(), By.id('srCode'), sr);
      await typeInto(d(), By.id('registrationCode'), code);
      await typeInto(d(), By.id('password'), password);
      await typeInto(d(), By.id('confirmPassword'), confirm);
      if (privacy) await jsClick(d(), await d().findElement(By.id('privacyAccepted')));
      const before = rows('users');
      await (await find(d(), By.css('form button[type="submit"]'))).click();
      const said = await expectReason(d(), await find(d(), By.css('form')));
      assert.equal(rows('users'), before, 'an account was created');
      return said;
    };
    it('sign up with passwords that do not match', async () => assert.match(await signUp({ confirm: 'Other-pass-123' }), /match/i));
    it('sign up with a 5-character password', async () => assert.match(await signUp({ password: 'ab12c' }), /8 characters/i));
    it('sign up without ticking the privacy notice', async () => assert.match(await signUp({ privacy: false }), /privacy/i));
    it('sign up with a registration code that does not exist', async () => assert.match(await signUp({}), /invalid|expired/i));
    it('sign up as an athlete with an SR code not on the registrar list', async () => {
      // A real athlete code, so the SR check is what refuses it.
      const code = `UIATH${RUN}`.toUpperCase();
      query(`App\\Models\\RegistrationCode::create(['code' => '${code}', 'role' => 'athlete', 'label' => 'UI test'])->code`);
      assert.match(await signUp({ role: 'Athlete -', sr: '00-00000', code }), /verify|SR Code|enrolled/i);
    });
  });

  /* ── The office's forms ── */
  describe("The office's forms", () => {
    before(async () => login(d(), 'admin'));

    it('a registration code that expires in -5 days', async () => {
      await visit(d(), '/admin/registration-codes');
      await (await button(d(), 'Generate Code')).click();
      const dialog = await openDialog(d());
      await setValue(d(), await dialog.findElement(By.id('expiresInDays')), '-5');
      const before = rows('registration_codes');
      await (await button(d(), 'Generate Code', dialog)).click();
      await expectReason(d(), dialog);
      assert.equal(rows('registration_codes'), before);
      await closeDialog(d());
    });

    const venueForm = async (fill) => {
      await visit(d(), '/admin/venues');
      await (await button(d(), 'Add Venue')).click();
      const dialog = await openDialog(d());
      await typeInto(d(), By.id('name'), `UI Venue ${RUN}`);
      await setValue(d(), await d().findElement(By.id('capacity')), '100');
      await typeInto(d(), By.id('location'), 'Test');
      await fill(dialog);
      const before = rows('venues');
      await (await button(d(), 'Create Venue', dialog)).click();
      await expectReason(d(), dialog);
      assert.equal(rows('venues'), before, 'a venue was saved');
      await closeDialog(d());
    };
    it('a venue with capacity 0', () => venueForm(async () => setValue(d(), await d().findElement(By.id('capacity')), '0')));
    it('a venue with capacity -50', () => venueForm(async () => setValue(d(), await d().findElement(By.id('capacity')), '-50')));
    it('a venue with a 300-character name', () => venueForm(async () => setValue(d(), await d().findElement(By.id('name')), LONG)));
    it('a venue with a name of only spaces', () => venueForm(async () => setValue(d(), await d().findElement(By.id('name')), '     ')));

    const eventForm = async () => {
      await visit(d(), '/admin/events');
      await (await button(d(), 'New Event')).click();
      let dialog = await openDialog(d());
      await typeInto(d(), By.css('[role="dialog"] input[placeholder^="e.g. Men"]'), `UI Game ${RUN}`);
      await pick(d(), (await dialog.findElements(By.css('[role="combobox"]')))[0], 'Basketball', { exact: true });
      await (await button(d(), 'Continue', dialog)).click();
      dialog = await openDialog(d());
      return dialog;
    };
    it('a game without picking the colleges', async () => {
      const dialog = await eventForm();
      await (await button(d(), 'Continue', dialog)).click();
      await expectReason(d(), dialog);
      await closeDialog(d());
    });
    it('the away college list leaves out the home college', async () => {
      const dialog = await eventForm();
      const sides = await dialog.findElements(By.css('[role="combobox"]'));
      await pick(d(), sides[0], 'College of Arts and Sciences', { exact: true });
      await sides[1].click();
      const options = [];
      for (const o of await d().findElements(By.css('[role="option"]'))) options.push((await o.getText()).trim());
      await d().actions().sendKeys('').perform();
      assert.ok(!options.includes('College of Arts and Sciences'), `away list: ${options.join(', ')}`);
      await closeDialog(d());
    });
    const timeStep = async (date, start, end) => {
      const dialog = await eventForm();
      const sides = await dialog.findElements(By.css('[role="combobox"]'));
      await pick(d(), sides[0], 'College of Arts and Sciences', { exact: true });
      await pick(d(), (await dialog.findElements(By.css('[role="combobox"]')))[1], 'College of Teacher Education', { exact: true });
      await (await button(d(), 'Continue', dialog)).click();
      const when = await openDialog(d());
      if (date !== null) await setValue(d(), await when.findElement(By.css('input[type="date"]')), date);
      const times = await when.findElements(By.css('input[type="time"]'));
      await setValue(d(), times[0], start);
      await setValue(d(), times[1], end);
      await (await button(d(), 'Continue', when)).click();
      const said = await expectReason(d(), when);
      await closeDialog(d());
      return said;
    };
    it('a game that ends before it starts (15:00 → 14:00)', async () => assert.match(await timeStep('2030-07-01', '15:00', '14:00'), /end|after|before/i));
    it('a game that ends the minute it starts', async () => assert.match(await timeStep('2030-07-01', '15:00', '15:00'), /end|after|before/i));
    it('a game with no date', async () => { await timeStep(null, '09:00', '10:00'); });

    it('a season with no name', async () => {
      await visit(d(), '/admin/seasons');
      const before = rows('seasons');
      const create = await find(d(), By.xpath("//button[normalize-space(.)='Create']"));
      if (await create.isEnabled()) {
        await create.click();
        await expectReason(d());
      }
      assert.equal(rows('seasons'), before);
    });

    it('a slideshow image that is really a PDF', async () => {
      await visit(d(), '/admin/carousel');
      await (await button(d(), 'Add slide')).click();
      const before = rows('site_slides');
      await attach(d(), await d().findElement(By.css('input[type="file"]')), 'document.pdf');
      const save = await find(d(), By.xpath("//button[normalize-space(.)='Save']"));
      if (await save.isEnabled()) await jsClick(d(), save);
      await expectReason(d());
      assert.equal(rows('site_slides'), before);
    });

    it('searching with odd characters (%, quotes, <, \\) breaks nothing', async () => {
      for (const [page, input] of [
        ['/admin/events', 'input[placeholder^="Search by name or sport"]'],
        ['/admin/users', 'input[placeholder="Search by name or email"]'],
      ]) {
        await visit(d(), page);
        const box = await find(d(), By.css(input));
        await box.sendKeys(`%' OR "1"="1 <b>\\ ${RUN}`);
        await d().sleep(800);
        assert.deepEqual(await pageErrors(d()), [], `crashed on ${page}`);
        assert.ok((await count(d(), By.css('main'))) > 0);
      }
    });
  });

  /* ── The coach's forms ── */
  describe("The coach's forms", () => {
    before(async () => login(d(), 'coach'));

    it('a training session that ends before it starts', async () => {
      await visit(d(), '/coach/attendance');
      await typeInto(d(), By.css('input[placeholder="e.g. Team training"]'), `UI Training ${RUN}`);
      await setValue(d(), await d().findElement(By.css('main input[type="date"]')), '2030-08-01');
      const times = await d().findElements(By.css('main input[type="time"]'));
      await setValue(d(), times[0], '19:00');
      await setValue(d(), times[1], '17:00');
      const before = rows('attendance_sessions');
      await (await button(d(), 'Create session')).click();
      await expectReason(d(), await find(d(), By.css('main')));
      assert.equal(rows('attendance_sessions'), before, 'the session was saved');
    });

    it('adding an athlete whose student ID is already taken', async () => {
      const taken = query("App\\Models\\Athlete::whereNotNull('student_id')->value('student_id')");
      await visit(d(), '/coach/athletes/new');
      await typeInto(d(), By.id('studentId'), taken);
      await typeInto(d(), By.id('firstName'), 'Dup');
      await typeInto(d(), By.id('lastName'), 'Licate');
      await typeInto(d(), By.id('email'), `dup.${RUN}@e2e.sportaxis.test`);
      for (const box of await d().findElements(By.css('main form [role="combobox"]'))) {
        if ((await box.getText()).includes('Select college')) await pick(d(), box, 'College of Arts and Sciences', { exact: true });
      }
      await typeInto(d(), By.id('course'), 'BS Testing');
      const before = rows('athletes');
      await (await button(d(), 'Add Athlete')).click();
      await expectReason(d(), await find(d(), By.css('main form')));
      assert.equal(rows('athletes'), before);
    });

    it('an appeal with a 6-character reason and no form', async () => {
      await visit(d(), '/coach/protests');
      await expectHeading(d(), 'Appeals');
      await typeInto(d(), By.css('textarea[placeholder^="What went wrong"]'), 'unfair');
      const before = rows('protests');
      await (await button(d(), 'Submit appeal')).click();
      await expectReason(d(), await find(d(), By.css('main')));
      assert.equal(rows('protests'), before);
    });

    it('an announcement title with a script tag shows as plain text', async () => {
      const title = `UI <img src=x onerror="window.__xss=1"> ${RUN}`;
      await visit(d(), '/coach/announcements');
      await (await button(d(), 'New Announcement')).click();
      const dialog = await openDialog(d());
      await typeInto(d(), By.id('title'), title);
      await typeInto(d(), By.id('content'), '<script>window.__xss=1</script> body');
      const toggle = await dialog.findElement(By.css('button[role="switch"]#isTryout'));
      if ((await toggle.getAttribute('aria-checked')) === 'true') await toggle.click();
      await (await button(d(), 'Create Announcement', dialog)).click();
      await d().wait(async () => (await count(d(), By.css('[role="dialog"]'))) === 0, 15000);
      await visit(d(), '/announcements');
      await findText(d(), RUN);
      assert.equal(await d().executeScript('return window.__xss || null'), null, 'injected code ran');
      assert.equal(await count(d(), By.css('main img[src="x"]')), 0, 'injected markup became a real element');
    });
  });

  /* ── The athlete's and the public forms ── */
  describe('The athlete and the public', () => {
    it('a requirement uploaded as a .txt file', async () => {
      await login(d(), 'athlete');
      await visit(d(), '/athlete/requirements');
      const txt = path.join(DOWNLOADS, `notes-${RUN}.txt`);
      fs.mkdirSync(DOWNLOADS, { recursive: true });
      fs.writeFileSync(txt, 'not a document');
      await jsClick(d(), await button(d(), 'Submit'));
      const dialog = await openDialog(d());
      const name = await dialog.findElements(By.id('name'));
      if (name.length) await name[0].sendKeys('Notes');
      await attach(d(), await dialog.findElement(By.id('file')), txt);
      const before = rows('requirements');
      await (await button(d(), 'Submit', dialog)).click();
      await expectReason(d(), dialog);
      assert.equal(rows('requirements'), before);
      await closeDialog(d());
    });

    it('changing the password with the wrong current password', async () => {
      await visit(d(), '/settings/account');
      await typeInto(d(), By.id('current-pw'), 'definitely-wrong-1');
      await typeInto(d(), By.id('new-pw'), 'New-pass-1234');
      await typeInto(d(), By.id('confirm-pw'), 'New-pass-1234');
      await (await button(d(), 'Update Password')).click();
      await expectReason(d(), await find(d(), By.css('main')));
    });

    it('a new password typed differently twice', async () => {
      await visit(d(), '/settings/account');
      await typeInto(d(), By.id('current-pw'), ACCOUNTS.athlete.password);
      await typeInto(d(), By.id('new-pw'), 'New-pass-1234');
      await typeInto(d(), By.id('confirm-pw'), 'New-pass-9999');
      await (await button(d(), 'Update Password')).click();
      await expectReason(d(), await find(d(), By.css('main')));
    });

    it('a tryout application with a bad student ID, short phone and a Gmail address', async () => {
      await visit(d(), '/');
      await d().executeScript('localStorage.clear()');
      await visit(d(), '/announcements');
      const apply = await d().findElements(By.xpath("//button[normalize-space(.)='Apply for Tryout']"));
      if (!apply.length) return; // no open tryout in this data
      await jsClick(d(), apply[0]);
      const dialog = await openDialog(d());
      await typeInto(d(), By.id('firstName'), 'Bad');
      await typeInto(d(), By.id('lastName'), 'Input');
      await typeInto(d(), By.id('studentId'), '12345');
      await typeInto(d(), By.id('phone'), '123');
      await typeInto(d(), By.id('email'), 'someone@gmail.com');
      const before = rows('email_verifications');
      await (await button(d(), 'Send Verification Code', dialog)).click();
      await expectReason(d(), dialog);
      assert.equal(rows('email_verifications'), before, 'a code was mailed anyway');
      await closeDialog(d());
    });

    it('addresses that do not exist show a not-found page, not a crash', async () => {
      for (const p of ['/bracket/does-not-exist', '/coach/athletes/not-a-real-id', '/no/such/page']) {
        await visit(d(), p);
        await d().sleep(1500);
        const text = await (await find(d(), By.css('body'))).getText();
        assert.ok(text.trim().length > 0, `blank page at ${p}`);
        assert.deepEqual(await pageErrors(d()), [], `crashed at ${p}`);
      }
    });
  });
});
