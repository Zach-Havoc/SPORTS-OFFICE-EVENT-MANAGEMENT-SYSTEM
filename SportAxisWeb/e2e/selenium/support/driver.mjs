/**
 * Shared Selenium setup for the end-to-end suite.
 *
 * Chrome opens on screen and the tests drive it by themselves. They sign in
 * with temporary accounts made just for the run (support/accounts.mjs) and
 * removed afterwards, and only ever against this machine.
 *
 *   E2E_BASE_URL      local site under test        (default http://localhost:5173)
 *   E2E_HEADLESS      "1" to run without a window   (default: the window is shown)
 *   E2E_SLOW_MS       pause after each page, to follow along (default 0)
 *   CHROME_BIN        a Chrome binary to drive      (default: Selenium Manager finds
 *                                                    or downloads Chrome for Testing)
 *
 * Specs only read and navigate. They never create events or send anything,
 * because the queue worker would email real people.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Builder, By, logging, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import { ACCOUNTS, assertLocal } from './accounts.mjs';

export { By, until, ACCOUNTS };

export const BASE_URL = (process.env.E2E_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
const HEADLESS = process.env.E2E_HEADLESS === '1';
const SLOW_MS = Number(process.env.E2E_SLOW_MS || 0);
const WAIT = Number(process.env.E2E_WAIT_MS || 15000);

const here = path.dirname(fileURLToPath(import.meta.url));
export const ARTIFACTS = path.resolve(here, '../artifacts');
export const DOWNLOADS = path.join(ARTIFACTS, 'downloads');
export const FIXTURES = path.resolve(here, '../fixtures');

export async function startBrowser({ width = 1366, height = 900 } = {}) {
  const options = new chrome.Options().addArguments(
    `--window-size=${width},${height}`,
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-search-engine-choice-screen',
  );
  if (HEADLESS) options.addArguments('--headless=new');
  fs.mkdirSync(DOWNLOADS, { recursive: true });
  options.setUserPreferences({
    'download.default_directory': DOWNLOADS,
    'download.prompt_for_download': false,
  });
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
  assertLocal();
  await driver.get(BASE_URL + pathname);
  if (SLOW_MS) await driver.sleep(SLOW_MS);
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
  if (!ACCOUNTS[role]) throw new Error(`No test account for "${role}"; the suite's setup did not run.`);
  const { email, password } = ACCOUNTS[role];
  await loginAs(driver, email, password, `/${role}`);
}

/**
 * Each account's session after its first sign-in, like a person who stays
 * signed in on their own device. Switching back to an account reuses it
 * instead of the form, which the server limits to 5 tries a minute.
 */
const sessions = new Map();

/**
 * Sign in with any account; `home` is where it should land. The first time
 * (or with `fresh`) this goes through the sign-in form.
 */
export async function loginAs(driver, email, password, home, { fresh = false } = {}) {
  await signOut(driver);
  const saved = sessions.get(email);
  if (saved && !fresh && home) {
    // A new browser starts on a blank page, which has no storage: open the site first.
    if (!(await driver.getCurrentUrl()).startsWith(BASE_URL)) await visit(driver, '/');
    await driver.executeScript('localStorage.setItem("auth_token", arguments[0])', saved);
    await visit(driver, home);
    const landed = await driver
      .wait(async () => ['/login', home].includes(await currentPath(driver)) ? currentPath(driver) : null, 30000)
      .catch(() => null);
    if (landed === home) return;
    sessions.delete(email); // signed out elsewhere; use the form
    await signOut(driver);
  }
  await visit(driver, '/login');
  await typeInto(driver, By.id('email'), email);
  await typeInto(driver, By.id('password'), password);
  await (await find(driver, By.css('form button[type="submit"]'))).click();
  if (home) {
    await waitForPath(driver, home, 30000);
    sessions.set(email, await driver.executeScript('return localStorage.getItem("auth_token")'));
  }
}

/** Forget the session in this browser (no UI). */
async function signOut(driver) {
  if (!(await driver.getCurrentUrl()).startsWith(BASE_URL)) return;
  await driver.executeScript('window.localStorage.clear(); window.sessionStorage.clear();');
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
 * Script failures in the page since the last call: uncaught exceptions,
 * React crashes, chunks that failed to load. Left out: HTTP failures (a 401
 * while logged out) and the app's own console.error lines for a request it
 * handled, e.g. a refused sign-in; specs assert on what the user sees.
 */
export async function pageErrors(driver) {
  const logs = await driver.manage().logs().get(logging.Type.BROWSER).catch(() => []);
  return logs
    .filter((l) => l.level.name === 'SEVERE')
    .map((l) => l.message)
    .filter((m) => !/Failed to load resource/i.test(m))
    .filter((m) => /Uncaught|dynamically imported module|ChunkLoadError|Minified React error|The above error occurred/i.test(m));
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

/**
 * Set an input's value the way React notices (date and time inputs can't be
 * typed into reliably: their format follows the browser's locale).
 */
export async function setValue(driver, el, value) {
  await driver.executeScript(
    `const el = arguments[0], value = arguments[1];
     const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype
       : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
     Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
     el.dispatchEvent(new Event('input', { bubbles: true }));
     el.dispatchEvent(new Event('change', { bubbles: true }));`,
    el,
    value,
  );
}

/** Attach a file to a file input, even one the page keeps hidden behind a button. */
export async function attach(driver, input, file) {
  await driver.executeScript(
    "arguments[0].style.display='block'; arguments[0].style.visibility='visible'; arguments[0].classList.remove('hidden');",
    input,
  );
  await input.sendKeys(path.isAbsolute(file) ? file : path.join(FIXTURES, file));
}

/** Pick an option in a native <select> by its visible text (or part of it). */
export async function selectNative(driver, select, text) {
  const value = await driver.executeScript(
    `const opt = [...arguments[0].options].find((o) => o.text.trim() === arguments[1])
       ?? [...arguments[0].options].find((o) => o.text.includes(arguments[1]));
     return opt ? opt.value : null;`,
    select,
    text,
  );
  if (value === null) throw new Error(`No option "${text}" in the list`);
  await setValue(driver, select, value);
}

/** Open a Radix select (combobox element) and click the option containing `text`. */
export async function pick(driver, trigger, text, { exact = false } = {}) {
  await driver.executeScript('arguments[0].scrollIntoView({block: "center"})', trigger);
  await trigger.click();
  const option = await findText(driver, text, { tag: '*[@role="option"]', exact });
  await option.click();
  await driver.wait(async () => (await driver.findElements(By.css('[role="listbox"]'))).length === 0, WAIT);
}

/** A button by its exact text, inside `scope` (an element) or the page. */
export async function button(driver, text, scope) {
  const xpath = `.//button[normalize-space(.)=${xpathLiteral(text)}]`;
  return driver.wait(async () => {
    const root = scope ?? (await driver.findElement(By.css('body')));
    for (const b of await root.findElements(By.xpath(xpath))) {
      if ((await b.isDisplayed().catch(() => false)) && (await b.isEnabled().catch(() => false))) return b;
    }
    return null;
  }, WAIT, `No enabled button "${text}"`);
}

/** Click via script: for buttons behind sticky bars or hover-only actions. */
export async function jsClick(driver, el) {
  await driver.executeScript('arguments[0].scrollIntoView({block: "center"}); arguments[0].click();', el);
}

/** The closest card-like ancestor of the first visible element containing `text`. */
export async function cardWith(driver, text, ancestor = 'div[contains(@class,"rounded")]') {
  const el = await findText(driver, text);
  return el.findElement(By.xpath(`./ancestor::${ancestor}[1]`));
}
