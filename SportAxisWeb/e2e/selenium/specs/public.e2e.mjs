/** Public pages: anyone can open them without an account. */
import assert from 'node:assert/strict';
import { currentPath, expectHeading, pageErrors, useBrowser, visit } from '../support/driver.mjs';

describe('Public site', () => {
  const browser = useBrowser();

  const pages = [
    ['/', 'Match Schedule'],
    ['/live', 'Live Scores'],
    ['/leaderboard', 'College Leaderboard'],
    ['/brackets', 'Tournament Brackets'],
    ['/announcements', 'Announcements'],
    ['/history', 'Event History'],
  ];

  for (const [path, title] of pages) {
    it(`${path} shows "${title}"`, async () => {
      const driver = browser();
      await visit(driver, path);
      await expectHeading(driver, title);
      assert.deepEqual(await pageErrors(driver), [], 'no script errors on the page');
    });
  }

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
