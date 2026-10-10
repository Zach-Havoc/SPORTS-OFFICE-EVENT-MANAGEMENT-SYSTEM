/** Signing in and out through the real form. */
import assert from 'node:assert/strict';
import {
  By,
  clickText,
  currentPath,
  find,
  findText,
  login,
  typeInto,
  useBrowser,
  visit,
  waitForPath,
} from '../support/driver.mjs';

describe('Sign in and sign out', () => {
  const browser = useBrowser();

  it('a wrong password is refused with a message, and stays on the sign-in page', async () => {
    const driver = browser();
    await visit(driver, '/login');
    // An address no account uses, so the real accounts' login limit isn't spent.
    await typeInto(driver, By.id('email'), 'nobody.e2e@university.edu');
    await typeInto(driver, By.id('password'), 'not-the-password');
    await (await find(driver, By.css('form button[type="submit"]'))).click();

    const alert = await find(driver, By.css('form [role="alert"]'));
    assert.ok((await alert.getText()).trim().length > 0, 'an error message is shown');
    assert.equal(await currentPath(driver), '/login');
  });

  it('the admin signs in and lands on the dashboard', async () => {
    const driver = browser();
    await login(driver, 'admin');
    assert.equal(await currentPath(driver), '/admin');
    await findText(driver, 'Registered athletes');
  });

  it('signing out from the account menu returns to the public site', async () => {
    const driver = browser();
    await (await find(driver, By.css('header button[aria-label^="Account"]'))).click();
    await (await findText(driver, 'Sign out', { tag: '*[@role="menuitem"]' })).click();
    // Confirm in the dialog.
    await clickText(driver, 'Sign out', { timeout: 5000 });
    await waitForPath(driver, '/');

    // The admin pages now ask for a sign-in again.
    await visit(driver, '/admin');
    await waitForPath(driver, '/login');
  });
});
