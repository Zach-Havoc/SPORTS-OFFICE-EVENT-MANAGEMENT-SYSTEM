/**
 * Shared Selenium setup for the end-to-end suite.
 *
 * Everything is configured by environment variables, so the same specs run
 * against the local dev servers or a deployed site:
 *
 *   E2E_BASE_URL      site under test             (default http://localhost:5173)
 *   E2E_HEADLESS      "0" to watch the browser     (default headless)
 *   CHROME_BIN        a Chrome binary to drive      (default: Selenium Manager finds
 *                                                    or downloads Chrome for Testing)
 *   E2E_<ROLE>_EMAIL / E2E_<ROLE>_PASSWORD  accounts (default: the demo data accounts)
 *
 * Specs only read and navigate. They never create events or send anything,
 * because the queue worker would email real people.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Builder, By, logging, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

export { By, until };

export const BASE_URL = (process.env.E2E_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
const HEADLESS = process.env.E2E_HEADLESS !== '0';
const WAIT = Number(process.env.E2E_WAIT_MS || 15000);

const here = path.dirname(fileURLToPath(import.meta.url));
export const ARTIFACTS = path.resolve(here, '../artifacts');

/** Demo-data accounts (sportaxis:reset-demo, password demo123). */
export const ACCOUNTS = {
  admin: { email: 'admin@university.edu' },
  coach: { email: 'coach15@g.batstate-u.edu.ph' },
  athlete: { email: 'athlete6@g.batstate-u.edu.ph' },
  judge: { email: 'judge4@g.batstate-u.edu.ph' },
};
for (const [role, acct] of Object.entries(ACCOUNTS)) {
  const key = role.toUpperCase();
  acct.email = process.env[`E2E_${key}_EMAIL`] || acct.email;
  acct.password = process.env[`E2E_${key}_PASSWORD`] || process.env.E2E_PASSWORD || 'demo123';
}

export async function startBrowser({ width = 1366, height = 900 } = {}) {
  const options = new chrome.Options().addArguments(
    `--window-size=${width},${height}`,
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-search-engine-choice-screen',
  );
  if (HEADLESS) options.addArguments('--headless=new');
  const prefs = new logging.Preferences();
  prefs.setLevel(logging.Type.BROWSER, logging.Level.SEVERE);
  options.setLoggingPrefs(prefs);
  if (process.env.CHROME_BIN) options.setChromeBinaryPath(process.env.CHROME_BIN);

  const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
  await driver.manage().setTimeouts({ implicit: 0, pageLoad: 60000 });
  return driver;
}

/** Open a path on the site under test. */
export async function visit(driver, pathname = '/') {
  await driver.get(BASE_URL + pathname);
}

export async function find(driver, locator, timeout = WAIT) {
  const el = await driver.wait(until.elementLocated(locator), timeout);
  await driver.wait(until.elementIsVisible(el), timeout);
  return el;
}

/** The first visible element containing this text (exact match on trimmed text when `exact`). */
export async function findText(driver, text, { tag = '*', exact = false, timeout = WAIT } = {}) {
  const lit = xpathLiteral(text);
  const cond = exact ? `normalize-space(.)=${lit}` : `contains(normalize-space(.), ${lit})`;
  // Deepest match only, so we get the element itself rather than <body>.
  const xpath = `//${tag}[${cond}][not(.//${tag}[${cond}])]`;
  return driver.wait(async () => {
    for (const el of await driver.findElements(By.xpath(xpath))) {
      if (await el.isDisplayed().catch(() => false)) return el;
    }
    return null;
  }, timeout, `No visible <${tag}> with text "${text}"`);
}

export async function clickText(driver, text, opts = {}) {
  const el = await findText(driver, text, { tag: 'button', exact: true, ...opts });
  await el.click();
  return el;
}

/** The page's main heading once it has rendered. */
export async function heading(driver, timeout = WAIT) {
  const h1 = await find(driver, By.css('main h1, h1'), timeout);
  return (await h1.getText()).trim();
}

/**
 * Wait until the main heading matches (a string, exactly, or a RegExp).
 * Pages load lazily, so right after a click the old page's heading is
 * still on screen; reading it once would race the navigation.
 */
export async function expectHeading(driver, expected, timeout = WAIT) {
  let last = '';
  await driver
    .wait(async () => {
      for (const h1 of await driver.findElements(By.css('h1'))) {
        last = (await h1.getText().catch(() => '')).trim();
        if (expected instanceof RegExp ? expected.test(last) : last === expected) return true;
      }
      return false;
    }, timeout)
    .catch(() => {
      throw new Error(`Expected the heading ${expected}, last saw "${last}"`);
    });
  return last;
}

export async function waitForPath(driver, pathname, timeout = WAIT) {
  await driver.wait(async () => new URL(await driver.getCurrentUrl()).pathname === pathname, timeout,
    `Expected to land on ${pathname}`);
}

export async function currentPath(driver) {
  return new URL(await driver.getCurrentUrl()).pathname;
}

/** Log in through the real form and wait for the role's home page. */
export async function login(driver, role) {
  const { email, password } = ACCOUNTS[role];
  await visit(driver, '/login');
  await typeInto(driver, By.id('email'), email);
  await typeInto(driver, By.id('password'), password);
  await (await find(driver, By.css('form button[type="submit"]'))).click();
  await waitForPath(driver, `/${role}`, 30000);
}

export async function typeInto(driver, locator, value) {
  const el = await find(driver, locator);
  await el.clear();
  await el.sendKeys(value);
  return el;
}

/** Forget the session without going through the UI. */
export async function logout(driver) {
  await visit(driver, '/');
  await driver.executeScript('window.localStorage.clear(); window.sessionStorage.clear();');
}

/**
 * Script errors in the page since the last call: uncaught exceptions, React
 * crashes, chunks that failed to load. Plain HTTP failures (a 401 while
 * logged out, a 404 image) are left out; specs assert on what the user sees.
 */
export async function pageErrors(driver) {
  const logs = await driver.manage().logs().get(logging.Type.BROWSER).catch(() => []);
  return logs
    .filter((l) => l.level.name === 'SEVERE')
    .map((l) => l.message)
    .filter((m) => !/Failed to load resource/i.test(m));
}

/** Save a screenshot under e2e/selenium/artifacts. */
export async function screenshot(driver, name) {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  const file = path.join(ARTIFACTS, `${name.replace(/[^\w.-]+/g, '_').slice(0, 120)}.png`);
  fs.writeFileSync(file, await driver.takeScreenshot(), 'base64');
  return file;
}

/**
 * Mocha wiring for a spec: one browser per file, a screenshot of every
 * failed test. Returns a getter, since the driver exists only after `before`.
 */
export function useBrowser(opts) {
  let driver;
  before(async function () {
    this.timeout(120000);
    driver = await startBrowser(opts);
  });
  afterEach(async function () {
    if (this.currentTest?.state === 'failed' && driver) {
      const file = await screenshot(driver, this.currentTest.fullTitle()).catch(() => null);
      if (file) console.log(`      screenshot: ${path.relative(process.cwd(), file)}`);
    }
  });
  after(async () => {
    await driver?.quit();
  });
  return () => driver;
}

function xpathLiteral(s) {
  if (!s.includes("'")) return `'${s}'`;
  if (!s.includes('"')) return `"${s}"`;
  return `concat('${s.replace(/'/g, `',"'",'`)}')`;
}

/** The open dialog (Radix dialog, alert dialog or sheet). */
export async function openDialog(driver, timeout = WAIT) {
  return find(driver, By.css('[role="dialog"], [role="alertdialog"]'), timeout);
}

/** Close the open dialog with Escape and wait until it is gone. */
export async function closeDialog(driver) {
  await driver.actions().sendKeys('').perform(); // Escape
  await driver.wait(async () => {
    for (const d of await driver.findElements(By.css('[role="dialog"], [role="alertdialog"]'))) {
      if (await d.isDisplayed().catch(() => false)) return false;
    }
    return true;
  }, WAIT, 'The dialog did not close');
}

/** Pick an option in a Radix select: open the trigger, click the option. */
export async function choose(driver, triggerLocator, optionText) {
  await (await find(driver, triggerLocator)).click();
  const option = await findText(driver, optionText, { tag: '*[@role="option"]', exact: true });
  await option.click();
  await driver.wait(async () => (await driver.findElements(By.css('[role="listbox"]'))).length === 0, WAIT);
}

/** Every option a Radix select offers (opens and closes it). */
export async function optionsOf(driver, triggerLocator) {
  await (await find(driver, triggerLocator)).click();
  await find(driver, By.css('[role="option"]'));
  const texts = [];
  for (const o of await driver.findElements(By.css('[role="option"]'))) texts.push((await o.getText()).trim());
  await driver.actions().sendKeys('').perform();
  return texts;
}

/** Click a link or button by its exact visible text. */
export async function clickLink(driver, text) {
  const el = await find(driver, By.xpath(`//a[normalize-space(.)=${xpathLiteral(text)}]`));
  await el.click();
  return el;
}

/** How many elements match right now (no waiting). */
export async function count(driver, locator) {
  return (await driver.findElements(locator)).length;
}
