/** The committee (judge) side. Scoring itself happens in the mobile app. */
import assert from 'node:assert/strict';
import { By } from 'selenium-webdriver';
import { count, expectHeading, login, pageErrors, useBrowser, visit } from '../support/driver.mjs';

describe('Committee', () => {
  const browser = useBrowser();
  before(async () => login(browser(), 'judge'));

  it('the panel lists the games assigned to the committee', async () => {
    const driver = browser();
    await visit(driver, '/judge');
    await expectHeading(driver, 'Committee Panel');
    await driver.wait(async () => (await count(driver, By.css('main h2, main [data-slot="card-title"]'))) > 0, 15000);
    assert.deepEqual(await pageErrors(driver), []);
  });

  it('Account Settings opens', async () => {
    const driver = browser();
    await visit(driver, '/settings/account');
    await expectHeading(driver, 'Account Settings');
  });
});
