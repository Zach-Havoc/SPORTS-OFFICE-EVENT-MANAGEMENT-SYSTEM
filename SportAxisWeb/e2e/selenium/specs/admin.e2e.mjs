/**
 * The Sports Office (admin) side: every page, plus the main read-only
 * actions in each module. Dialogs are opened and closed, never submitted.
 */
import assert from 'node:assert/strict';
import { By, Key } from 'selenium-webdriver';
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
  optionsOf,
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

  describe('Dashboard', () => {
    it('shows the four headline figures and the charts', async () => {
      const driver = browser();
      await visit(driver, '/admin');
      for (const label of ['Live today', 'Coming up · 7 days', 'Pending requests', 'Registered athletes']) {
        await findText(driver, label);
      }
      await findText(driver, 'Athletes by college');
      await findText(driver, 'College standings');
      assert.ok((await count(driver, By.css('canvas, svg.recharts-surface'))) > 0, 'at least one chart is drawn');
      assert.deepEqual(await pageErrors(driver), []);
    });

    it('the notifications bell opens the list', async () => {
      const driver = browser();
      await (await find(driver, By.css('header button[aria-label^="Notifications"]'))).click();
      await find(driver, By.css('[role="dialog"], [role="menu"]'));
      await driver.actions().sendKeys(Key.ESCAPE).perform();
    });

    it('Ctrl+K page search jumps to a page', async () => {
      const driver = browser();
      await visit(driver, '/admin');
      await find(driver, By.css('header'));
      await driver.actions().keyDown(Key.CONTROL).sendKeys('k').keyUp(Key.CONTROL).perform();
      const input = await find(driver, By.css('[role="dialog"] input'));
      await input.sendKeys('Venues');
      await input.sendKeys(Key.ENTER);
      await waitForPath(driver, '/admin/venues');
    });
  });

  describe('Every page opens from the sidebar', () => {
    const sidebar = [
      ['Events', '/admin/events', 'Sports Event Management'],
      ['Seasons', '/admin/seasons', 'Seasons'],
      ['Bracketing', '/admin/bracketing', 'Automatic Bracketing'],
      ['Venues', '/admin/venues', 'Venue Management'],
      ['Appeals', '/admin/protests', 'Appeals'],
      ['Users', '/admin/users', 'User Management'],
      ['Coaches', '/admin/coaches', 'Coach Management'],
      ['CMO Requirements', '/admin/requirements', 'CMO Requirements'],
      ['Transactions', '/admin/transactions', 'Transactions'],
      ['Registration Codes', '/admin/registration-codes', 'Registration Codes'],
      ['Reports', '/admin/reports', 'Reports & Results'],
      ['History', '/admin/history', 'Event History'],
      ['Recovery & Audit', '/admin/trash', 'Recovery & Audit'],
      ['Site Content', '/admin/carousel', 'Site Content'],
      ['Settings', '/admin/settings', 'System Settings'],
    ];

    for (const [link, path, title] of sidebar) {
      it(`${link}`, async () => {
        const driver = browser();
        const a = await find(driver, By.xpath(`//aside//a[normalize-space(.)='${link}']`));
        await a.click();
        await waitForPath(driver, path);
        await expectHeading(driver, title);
        assert.deepEqual(await pageErrors(driver), []);
      });
    }
  });

  describe('Events', () => {
    beforeEach(async () => {
      await visit(browser(), '/admin/events');
      await expectHeading(browser(), 'Sports Event Management');
    });

    it('shows the event counts', async () => {
      const driver = browser();
      for (const label of ['Total Events', 'Upcoming', 'Ongoing', 'Completed']) await findText(driver, label);
    });

    it('search narrows the list to nothing for an unknown name', async () => {
      const driver = browser();
      const search = await find(driver, By.css('input[placeholder^="Search by name or sport"]'));
      await search.sendKeys('zzz-no-such-event');
      await findText(driver, 'No events', { timeout: 10000 });
    });

    it('the sport filter lists the sports', async () => {
      const driver = browser();
      const options = await optionsOf(driver, By.xpath("//main//button[normalize-space(.)='All sports']"));
      assert.ok(options.includes('All sports'));
      assert.ok(options.length > 1, `sports offered: ${options.join(', ')}`);
    });

    it('New Event opens the four-part form, and Escape closes it', async () => {
      const driver = browser();
      await clickText(driver, 'New Event');
      const dialog = await openDialog(driver);
      await dialog.findElement(By.css('ol[aria-label="Event form"]'));
      await closeDialog(driver);
    });

    it('switches between grid and list view', async () => {
      const driver = browser();
      await (await find(driver, By.css('button[aria-label="List view"]'))).click();
      await (await find(driver, By.css('button[aria-label="Grid view"]'))).click();
      assert.deepEqual(await pageErrors(driver), []);
    });
  });

  describe('Venues', () => {
    it('shows the venue counts and a venue schedule', async () => {
      const driver = browser();
      await visit(driver, '/admin/venues');
      for (const label of ['Total Venues', 'Indoor', 'Outdoor']) await findText(driver, label);
      await clickText(driver, 'View schedule');
      await openDialog(driver);
      await closeDialog(driver);
    });
  });

  describe('Seasons and bracketing', () => {
    it('Seasons lists every edition', async () => {
      const driver = browser();
      await visit(driver, '/admin/seasons');
      await findText(driver, 'All editions');
    });

    it('Bracketing offers the three formats', async () => {
      const driver = browser();
      await visit(driver, '/admin/bracketing');
      for (const f of ['Single elim.', 'Double elim.', 'Round robin']) await findText(driver, f, { tag: 'button', exact: true });
      await findText(driver, 'Generate bracket', { tag: 'button', exact: true });
    });
  });

  describe('People', () => {
    it('Users can be searched', async () => {
      const driver = browser();
      await visit(driver, '/admin/users');
      await expectHeading(driver, 'User Management');
      const search = await find(driver, By.css('input[placeholder="Search by name or email"]'));
      await search.sendKeys('admin@university.edu');
      await findText(driver, 'admin@university.edu');
    });

    it('Coaches lists coaches with their college', async () => {
      const driver = browser();
      await visit(driver, '/admin/coaches');
      await findText(driver, 'Assign College', { tag: 'button', exact: true });
    });

    it('CMO Requirements switches between the college board and all documents', async () => {
      const driver = browser();
      await visit(driver, '/admin/requirements');
      await expectHeading(driver, 'CMO Requirements');
      const tab = (name) => find(driver, By.xpath(`//*[@role="tab"][normalize-space(.)='${name}']`));
      assert.equal(await (await tab('By college & sport')).getAttribute('aria-selected'), 'true');
      await (await tab('All documents')).click();
      await findText(driver, 'Pending Review');
      await (await tab('By college & sport')).click();
      assert.equal(await (await tab('By college & sport')).getAttribute('aria-selected'), 'true');
    });

    it('Transactions filters by state', async () => {
      const driver = browser();
      await visit(driver, '/admin/transactions');
      for (const f of ['Open', 'Decided', 'All']) {
        await clickText(driver, f);
      }
      assert.deepEqual(await pageErrors(driver), []);
    });

    it('Registration Codes shows the code lists', async () => {
      const driver = browser();
      await visit(driver, '/admin/registration-codes');
      for (const t of ['Active Codes', 'Used Codes', 'Expired Codes']) await findText(driver, t);
    });

    it('Appeals lists the appeals', async () => {
      const driver = browser();
      await visit(driver, '/admin/protests');
      await expectHeading(driver, 'Appeals');
      await findText(driver, 'All appeals');
    });
  });

  describe('Records', () => {
    it('Reports offers printing and CSV for each document', async () => {
      const driver = browser();
      await visit(driver, '/admin/reports');
      for (const t of ['College standings', 'All results', 'Certificates', 'Event result sheet']) await findText(driver, t);
      assert.ok((await count(driver, By.xpath("//button[normalize-space(.)='Print / PDF']"))) >= 2);
      assert.ok((await count(driver, By.xpath("//button[normalize-space(.)='CSV']"))) >= 2);
    });

    it('History filters by season and college', async () => {
      const driver = browser();
      await visit(driver, '/admin/history');
      await expectHeading(driver, 'Event History');
      await findText(driver, 'All colleges', { tag: 'button' });
    });

    it('Recovery & Audit shows the recycle bin and the audit trail', async () => {
      const driver = browser();
      await visit(driver, '/admin/trash');
      await findText(driver, 'Recycle Bin');
      await findText(driver, 'Audit Trail');
    });
  });

  describe('Site content and settings', () => {
    it('Site Content has the slideshow and the welcome popup', async () => {
      const driver = browser();
      await visit(driver, '/admin/carousel');
      await (await findText(driver, 'Welcome Popup', { tag: '*[@role="tab"]' })).click();
      await (await findText(driver, 'Match Schedule Slideshow', { tag: '*[@role="tab"]' })).click();
      assert.deepEqual(await pageErrors(driver), []);
    });

    it('every Settings section opens', async () => {
      const driver = browser();
      await visit(driver, '/admin/settings');
      const sections = [
        ['Sports', 'Sports'],
        ['Students', 'Campus Students'],
        ['Standings', null],
        ['System', null],
        ['Colleges', 'Colleges'],
      ];
      for (const [tab, title] of sections) {
        await clickText(driver, tab);
        if (title) await findText(driver, title, { tag: '*[@data-slot="card-title"]', exact: true });
        await expectHeading(driver, 'System Settings');
      }
      assert.deepEqual(await pageErrors(driver), []);
    });

    it('Account Settings opens from the account menu', async () => {
      const driver = browser();
      await (await find(driver, By.css('header button[aria-label^="Account"]'))).click();
      const item = await find(driver, By.xpath("//*[@role='menuitem'][contains(normalize-space(.), 'Account')]"));
      await item.click();
      await waitForPath(driver, '/settings/account');
      await expectHeading(driver, 'Account Settings');
      assert.equal(await currentPath(driver), '/settings/account');
    });
  });
});
