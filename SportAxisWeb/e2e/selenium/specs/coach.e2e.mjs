/** The coach side: every page, plus read-only actions. Nothing is saved. */
import assert from 'node:assert/strict';
import { By } from 'selenium-webdriver';
import {
  clickText,
  closeDialog,
  count,
  currentPath,
  expectHeading,
  find,
  findText,
  login,
  openDialog,
  pageErrors,
  useBrowser,
  visit,
  waitForPath,
} from '../support/driver.mjs';

describe('Coach', () => {
  const browser = useBrowser();
  before(async () => login(browser(), 'coach'));

  describe('Every page opens', () => {
    const pages = [
      ['/coach', /^Good (morning|afternoon|evening)/],
      ['/coach/athletes', / Team$/],
      ['/coach/lineup', 'Line-up'],
      ['/coach/schedule', 'My Schedule'],
      ['/coach/attendance', 'Attendance'],
      ['/coach/performance', 'Performance Records'],
      ['/coach/requirements', 'CMO Requirements'],
      ['/coach/tryouts', 'Tryout Applicants'],
      ['/coach/protests', 'Appeals'],
      ['/coach/announcements', 'My Announcements'],
      ['/coach/athletes/new', 'Add New Athlete'],
      ['/settings/account', 'Account Settings'],
    ];
    for (const [path, title] of pages) {
      it(`${path}`, async () => {
        const driver = browser();
        await visit(driver, path);
        await expectHeading(driver, title);
        assert.deepEqual(await pageErrors(driver), []);
      });
    }
  });

  describe('Athletes', () => {
    it('opens an athlete from the roster and walks through their record', async () => {
      const driver = browser();
      await visit(driver, '/coach/athletes');
      await expectHeading(driver, / Team$/);
      const link = await find(driver, By.xpath("//main//a[starts-with(@href, '/coach/athletes/') and not(contains(@href, '/edit')) and not(contains(@href, '/new'))]"));
      await link.click();
      await driver.wait(async () => /^\/coach\/athletes\/[^/]+$/.test(await currentPath(driver)), 15000);
      for (const t of ['Personal Information', 'Emergency Contact']) await findText(driver, t);
      for (const tab of ['Attendance', 'Games', 'Performance', 'Requirements', 'All']) {
        await (await find(driver, By.xpath(`//main//button[starts-with(normalize-space(.), '${tab}')]`))).click();
      }
      assert.deepEqual(await pageErrors(driver), []);
    });

    it("the edit page loads the athlete's details, and Cancel leaves without saving", async () => {
      const driver = browser();
      await clickText(driver, 'Edit').catch(async () => (await find(driver, By.xpath("//main//a[normalize-space(.)='Edit']"))).click());
      await expectHeading(driver, 'Athlete Details');
      await clickText(driver, 'Cancel');
      await driver.wait(async () => !(await currentPath(driver)).endsWith('/edit'), 15000);
    });

    it('the add form refuses an empty athlete', async () => {
      const driver = browser();
      await visit(driver, '/coach/athletes/new');
      await expectHeading(driver, 'Add New Athlete');
      await clickText(driver, 'Add Athlete');
      // The browser's own required-field check stops it before anything is sent.
      const valid = await driver.executeScript("return document.querySelector('main form').checkValidity()");
      assert.equal(valid, false, 'an empty form is not valid');
      const firstInvalid = await driver.executeScript("return document.querySelector('main form :invalid')?.placeholder ?? null");
      assert.ok(firstInvalid, 'a required field is flagged');
      assert.equal(await currentPath(driver), '/coach/athletes/new');
    });
  });

  describe('Tools', () => {
    it('the schedule picks a day', async () => {
      const driver = browser();
      await visit(driver, '/coach/schedule');
      await findText(driver, 'Pick a date');
      for (const t of ['Upcoming Games', 'Ongoing Games', 'Total Games']) await findText(driver, t);
    });

    it('Record Performance opens its form, and Escape closes it', async () => {
      const driver = browser();
      await visit(driver, '/coach/performance');
      await clickText(driver, 'Record Performance');
      await openDialog(driver);
      await closeDialog(driver);
    });

    it('New Announcement opens its form, and Escape closes it', async () => {
      const driver = browser();
      await visit(driver, '/coach/announcements');
      await clickText(driver, 'New Announcement');
      await findText(driver, 'Create New Announcement');
      await closeDialog(driver);
    });

    it('Attendance can schedule a training session', async () => {
      const driver = browser();
      await visit(driver, '/coach/attendance');
      await findText(driver, 'Schedule training');
      await findText(driver, 'Create session', { tag: 'button', exact: true });
    });

    it('Tryout applicants switch between to decide, accepted and not accepted', async () => {
      const driver = browser();
      await visit(driver, '/coach/tryouts');
      await find(driver, By.css('[role="tablist"] [role="tab"]'));
      const tabs = await driver.findElements(By.css('[role="tablist"] [role="tab"]'));
      assert.equal(tabs.length, 3);
      for (const t of tabs) {
        await t.click();
        assert.equal(await t.getAttribute('aria-selected'), 'true');
      }
    });

    it('CMO Requirements has the panel for forwarding athletes to the office', async () => {
      const driver = browser();
      await visit(driver, '/coach/requirements');
      await findText(driver, 'Forward to the Sports Office');
    });

    it('Appeals has the filing form with the PDF attachment', async () => {
      const driver = browser();
      await visit(driver, '/coach/protests');
      await findText(driver, 'File an appeal');
      await findText(driver, 'Attach the formal protest form (PDF)');
      assert.ok((await count(driver, By.css('input[type="file"]'))) >= 1);
    });

    it("the line-up lists the college's games, or says there are none", async () => {
      const driver = browser();
      await visit(driver, '/coach/lineup');
      await expectHeading(driver, 'Line-up');
      // Depends on the schedule: the test coach's college may have no upcoming games.
      await driver.wait(
        async () =>
          (await count(driver, By.xpath("//main//*[normalize-space(.)='Games']"))) > 0 ||
          (await count(driver, By.xpath("//main//*[contains(., 'Nothing to set up here')]"))) > 0,
        15000,
      );
      assert.deepEqual(await pageErrors(driver), []);
    });
  });

  it('the sidebar links all lead to coach pages', async () => {
    const driver = browser();
    await visit(driver, '/coach');
    await find(driver, By.css('aside a[href]'));
    const hrefs = [];
    for (const a of await driver.findElements(By.css('aside a[href]'))) hrefs.push(new URL(await a.getAttribute('href')).pathname);
    assert.ok(hrefs.length >= 6, `sidebar links: ${hrefs.join(', ')}`);
    for (const h of [...new Set(hrefs)]) {
      await visit(driver, h);
      await waitForPath(driver, h);
      await find(driver, By.css('h1'));
      assert.deepEqual(await pageErrors(driver), [], `script errors on ${h}`);
    }
  });
});
