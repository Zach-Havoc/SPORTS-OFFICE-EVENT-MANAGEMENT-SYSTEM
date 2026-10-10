/**
 * Mocha reporter: the usual "spec" console output, plus a JSON file with
 * every test's result and duration (for the testing report).
 *
 *   mocha --reporter e2e/selenium/support/spec-json-reporter.cjs --reporter-option output=results.json
 */
const fs = require('node:fs');
const path = require('node:path');
const Mocha = require('mocha');

class SpecAndJson extends Mocha.reporters.Spec {
  constructor(runner, options = {}) {
    super(runner, options);
    const out = (options.reporterOption || options.reporterOptions || {}).output;
    const tests = new Map();
    const record = (test, state) =>
      tests.set(test.fullTitle(), {
        suite: test.parent ? test.parent.fullTitle() : '',
        title: test.title,
        state,
        durationMs: test.duration || 0,
        error: test.err ? String(test.err.message).split('\n')[0] : undefined,
      });
    runner.on('pass', (t) => record(t, 'passed'));
    runner.on('fail', (t) => record(t, 'failed'));
    runner.on('pending', (t) => record(t, 'pending'));
    runner.once('end', () => {
      if (!out) return;
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, JSON.stringify({ stats: runner.stats, tests: [...tests.values()] }, null, 2));
    });
  }
}

module.exports = SpecAndJson;
