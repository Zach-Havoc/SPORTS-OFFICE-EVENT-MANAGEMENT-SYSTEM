/** Coach, athlete and committee home pages and their main tools. Read-only. */
import assert from 'node:assert/strict';
import { expectHeading, findText, login, pageErrors, useBrowser, visit } from '../support/driver.mjs';

function rolePages(role, pages, extra) {
  describe(role[0].toUpperCase() + role.slice(1), () => {
    const browser = useBrowser();
    // One browser per role (useBrowser), so no sign-out is needed afterwards.
    before(async () => login(browser(), role));

    for (const [path, title] of pages) {
      it(`${path} shows "${title}"`, async () => {
        const driver = browser();
        await visit(driver, path);
        await expectHeading(driver, title);
        assert.deepEqual(await pageErrors(driver), []);
      });
    }
    extra?.(browser);
  });
}

rolePages(
  'coach',
  [
    ['/coach', 'Coach Dashboard'],
    ['/coach/athletes', / Team$/],
    ['/coach/requirements', 'CMO Requirements'],
    ['/coach/attendance', 'Attendance'],
    ['/coach/tryouts', 'Tryout Applicants'],
  ],
  (browser) => {
    it('CMO Requirements has the panel for forwarding athletes to the office', async () => {
      const driver = browser();
      await visit(driver, '/coach/requirements');
      await findText(driver, 'Forward to the Sports Office');
    });
  },
);

rolePages('athlete', [
  ['/athlete', /^Hello, /],
  ['/athlete/schedule', 'My Schedule'],
  ['/athlete/requirements', 'My CMO Requirements'],
  ['/athlete/team', 'My Team'],
]);

rolePages('judge', [['/judge', 'Committee Panel']]);
