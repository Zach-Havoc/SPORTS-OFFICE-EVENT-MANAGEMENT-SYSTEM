/** The committee (judge) side. Scoring itself happens in the mobile app. */
import assert from 'node:assert/strict';
import { By } from 'selenium-webdriver';
import { count, expectHeading, login, pageErrors, useBrowser, visit } from '../support/driver.mjs';

describe('Committee', () => {
  const browser = useBrowser();
  before(async () => login(browser(), 'judge'));

  it('the panel shows the assigned games, or says there are none', async () => {
    const driver = browser();
    await visit(driver, '/judge');
    await expectHeading(driver, 'Committee Panel');
    // The test committee member is new, so usually nothing is assigned yet.
    await driver.wait(
      async () =>
        (await count(driver, By.xpath("//main//*[contains(., 'No games assigned right now')]"))) > 0 ||
        (await count(driver, By.css('main h2, main [data-slot="card-title"]'))) > 0,
      15000,
    );
    assert.deepEqual(await pageErrors(driver), []);
  });

  it('Account Settings opens', async () => {
    const driver = browser();
    await visit(driver, '/settings/account');
    await expectHeading(driver, 'Account Settings');
  });
});
