/** Each role is kept to its own pages. */
import assert from 'node:assert/strict';
import { currentPath, login, logout, useBrowser, visit, waitForPath } from '../support/driver.mjs';

describe('Role access', () => {
  const browser = useBrowser();

  it('a visitor who is not signed in is sent to sign in', async () => {
    const driver = browser();
    for (const path of ['/admin', '/coach', '/athlete/requirements']) {
      await visit(driver, path);
      await waitForPath(driver, '/login');
    }
  });

  it('a coach cannot open admin pages', async () => {
    const driver = browser();
    await login(driver, 'coach');
    await visit(driver, '/admin/users');
    await waitForPath(driver, '/coach');
    assert.equal(await currentPath(driver), '/coach');
    await logout(driver);
  });

  it('an athlete cannot open admin or coach pages', async () => {
    const driver = browser();
    await login(driver, 'athlete');
    await visit(driver, '/admin');
    await waitForPath(driver, '/athlete');
    await visit(driver, '/coach/athletes');
    await waitForPath(driver, '/athlete');
    await logout(driver);
  });
});
