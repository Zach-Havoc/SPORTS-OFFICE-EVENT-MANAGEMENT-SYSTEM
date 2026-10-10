/** Public pages: anyone can open them without an account. */
import assert from 'node:assert/strict';
import { By } from 'selenium-webdriver';
import {
  count,
  currentPath,
  expectHeading,
  find,
  findText,
  optionsOf,
  pageErrors,
  useBrowser,
  visit,
} from '../support/driver.mjs';

describe('Public site', () => {
  const browser = useBrowser();

  const pages = [
    ['/', 'Match Schedule'],
    ['/live', 'Live Scores'],
    ['/leaderboard', 'College Leaderboard'],
    ['/brackets', 'Tournament Brackets'],
    ['/announcements', 'Announcements'],
    ['/history', 'Event History'],
    ['/standings', 'OFFICIAL STANDINGS'],
  ];

  for (const [path, title] of pages) {
    it(`${path} shows "${title}"`, async () => {
      const driver = browser();
      await visit(driver, path);
      await expectHeading(driver, title);
      assert.deepEqual(await pageErrors(driver), [], 'no script errors on the page');
    });
  }

  it('the privacy notice explains the data collected', async () => {
    const driver = browser();
    await visit(driver, '/privacy-notice');
    for (const t of ['Data Privacy Notice', 'What we collect', 'Your rights']) await findText(driver, t);
  });

  it('the leaderboard lists the colleges', async () => {
    const driver = browser();
    await visit(driver, '/leaderboard');
    await expectHeading(driver, 'College Leaderboard');
    await driver.wait(async () => (await count(driver, By.css('main tbody tr, main li'))) > 0, 15000, 'no colleges listed');
  });

  it('a bracket opens from the bracket list', async () => {
    const driver = browser();
    await visit(driver, '/brackets');
    const link = await find(driver, By.css('main a[href^="/bracket/"]'));
    await link.click();
    await driver.wait(async () => (await currentPath(driver)).startsWith('/bracket/'), 15000);
    await findText(driver, 'Round 1');
    assert.deepEqual(await pageErrors(driver), []);
  });

  it('announcements filter by department and sport, and search', async () => {
    const driver = browser();
    await visit(driver, '/announcements');
    await expectHeading(driver, 'Announcements');
    // The filters are built from the loaded announcements.
    await driver.wait(async () => (await driver.findElements(By.xpath("//*[contains(., 'Loading announcements')]"))).length === 0, 20000);
    const depts = await optionsOf(driver, By.css('button[aria-label="Filter by department"]'));
    assert.ok(depts.length > 1, `departments: ${depts.join(', ')}`);
    const sports = await optionsOf(driver, By.css('button[aria-label="Filter by sport"]'));
    assert.ok(sports.length > 1, `sports: ${sports.join(', ')}`);
    const search = await find(driver, By.css('input[aria-label="Search announcements"]'));
    await search.sendKeys('zzz-nothing-like-this');
    await driver.wait(async () => (await driver.findElements(By.xpath("//main//*[contains(., 'No announcements') or contains(., 'Nothing matches') or contains(., 'No results')]"))).length > 0, 10000, 'no empty state for an unknown search');
  });

  it('an unknown address shows the not-found page', async () => {
    const driver = browser();
    await visit(driver, '/no-such-page');
    await expectHeading(driver, 'That page is not here');
  });

  it('the sign-in page is reachable', async () => {
    const driver = browser();
    await visit(driver, '/login');
    await expectHeading(driver, 'Sign in');
    assert.equal(await currentPath(driver), '/login');
  });
});
