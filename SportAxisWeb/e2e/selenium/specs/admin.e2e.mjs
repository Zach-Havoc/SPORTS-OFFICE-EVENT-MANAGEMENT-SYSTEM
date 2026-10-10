/** The Sports Office (admin) side. Read-only: nothing is created or changed. */
import assert from 'node:assert/strict';
import { By, Key } from 'selenium-webdriver';
import {
  currentPath,
  find,
  findText,
  expectHeading,
  login,
  pageErrors,
  useBrowser,
  visit,
  waitForPath,
} from '../support/driver.mjs';

describe('Admin', () => {
  const browser = useBrowser();

  before(async () => {
    await login(browser(), 'admin');
  });

  it('the dashboard shows the four headline figures', async () => {
    const driver = browser();
    await visit(driver, '/admin');
    for (const label of ['Live today', 'Coming up · 7 days', 'Pending requests', 'Registered athletes']) {
      await findText(driver, label);
    }
    assert.deepEqual(await pageErrors(driver), []);
  });

  const sidebar = [
    ['Events', '/admin/events', 'Sports Event Management'],
    ['Venues', '/admin/venues', 'Venue Management'],
    ['Appeals', '/admin/protests', 'Appeals'],
    ['CMO Requirements', '/admin/requirements', 'CMO Requirements'],
    ['Transactions', '/admin/transactions', 'Transactions'],
    ['Reports', '/admin/reports', 'Reports & Results'],
  ];

  for (const [link, path, title] of sidebar) {
    it(`the sidebar opens ${link}`, async () => {
      const driver = browser();
      const a = await find(driver, By.xpath(`//aside//a[normalize-space(.)='${link}'] | //nav//a[normalize-space(.)='${link}']`));
      await a.click();
      await waitForPath(driver, path);
      await expectHeading(driver, title);
      assert.deepEqual(await pageErrors(driver), []);
    });
  }

  it('the events search narrows the list', async () => {
    const driver = browser();
    await visit(driver, '/admin/events');
    const search = await find(driver, By.css('input[placeholder^="Search by name or sport"]'));
    await search.sendKeys('zzz-no-such-event');
    await findText(driver, 'No events', { timeout: 10000 });
  });

  it('CMO Requirements switches between the college board and all documents', async () => {
    const driver = browser();
    await visit(driver, '/admin/requirements');
    await expectHeading(driver, 'CMO Requirements');
    const tab = (name) => find(driver, By.xpath(`//*[@role="tab"][normalize-space(.)='${name}']`));
    assert.equal(await (await tab('By college & sport')).getAttribute('aria-selected'), 'true');

    await (await tab('All documents')).click();
    await findText(driver, 'Pending Review');
    assert.equal(await (await tab('All documents')).getAttribute('aria-selected'), 'true');

    await (await tab('By college & sport')).click();
    assert.equal(await (await tab('By college & sport')).getAttribute('aria-selected'), 'true');
  });

  it('Ctrl+K opens the page search', async () => {
    const driver = browser();
    await visit(driver, '/admin');
    await find(driver, By.css('header'));
    await driver.actions().keyDown(Key.CONTROL).sendKeys('k').keyUp(Key.CONTROL).perform();
    const input = await find(driver, By.css('[role="dialog"] input'));
    await input.sendKeys('Venues');
    await input.sendKeys(Key.ENTER);
    await waitForPath(driver, '/admin/venues');
    assert.equal(await currentPath(driver), '/admin/venues');
  });
});
