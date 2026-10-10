/** The athlete side: every page. Nothing is uploaded or saved. */
import assert from 'node:assert/strict';
import { By } from 'selenium-webdriver';
import { expectHeading, find, findText, login, pageErrors, useBrowser, visit, waitForPath } from '../support/driver.mjs';

describe('Athlete', () => {
  const browser = useBrowser();
  before(async () => login(browser(), 'athlete'));

  const pages = [
    ['/athlete', /^Hello, /, []],
    ['/athlete/schedule', 'My Schedule', ['Upcoming Games', 'Pick a date']],
    ['/athlete/performance', 'My Performance', ['Average Rating', 'Performance History']],
    ['/athlete/attendance', 'My Attendance', ['History']],
    ['/athlete/requirements', 'My CMO Requirements', ['Required Documents']],
    ['/athlete/team', 'My Team', ['Teammates']],
    ['/settings/account', 'Account Settings', ['Student Profile', 'Change Password']],
  ];

  for (const [path, title, texts] of pages) {
    it(`${path}`, async () => {
      const driver = browser();
      await visit(driver, path);
      await expectHeading(driver, title);
      for (const t of texts) await findText(driver, t);
      assert.deepEqual(await pageErrors(driver), []);
    });
  }

  it('the sidebar links all lead to athlete pages', async () => {
    const driver = browser();
    await visit(driver, '/athlete');
    await find(driver, By.css('aside a[href]'));
    const hrefs = [];
    for (const a of await driver.findElements(By.css('aside a[href]'))) hrefs.push(new URL(await a.getAttribute('href')).pathname);
    assert.ok(hrefs.length >= 4, `sidebar links: ${hrefs.join(', ')}`);
    for (const h of [...new Set(hrefs)]) {
      await visit(driver, h);
      await waitForPath(driver, h);
      await find(driver, By.css('h1'));
      assert.deepEqual(await pageErrors(driver), [], `script errors on ${h}`);
    }
  });
});
