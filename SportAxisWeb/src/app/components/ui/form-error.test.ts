/**
 * Pop-up messages are switched off on this site (sonner is a no-op in the
 * build), so an error passed to toast.error() is never seen: the user
 * clicks Save and nothing happens. Every error must be shown on the page,
 * with <FormError>. This test fails if toast.error creeps back in.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const APP = path.resolve(__dirname, '../..');

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return sources(full);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name) ? [full] : [];
  });
}

describe('errors are shown on the page', () => {
  it('no source file reports an error only through a pop-up (toast.error)', () => {
    const offenders = sources(APP)
      .filter((f) => !f.endsWith('toastNoop.ts'))
      .flatMap((f) =>
        fs.readFileSync(f, 'utf8').split('\n')
          .map((line, i) => ({ line, at: `${path.relative(APP, f)}:${i + 1}` }))
          .filter(({ line }) => /toast\.error\s*\(/.test(line) && !/^\s*(\/\/|\*|\{\/\*)/.test(line))
          .map(({ at }) => at),
      );
    expect(offenders).toEqual([]);
  });
});
