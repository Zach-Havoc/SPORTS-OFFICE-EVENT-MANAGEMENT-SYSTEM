/**
 * Synthetic score sheets for the OCR accuracy test.
 *
 *   npx vite-node e2e/ocr-accuracy/generate.ts [count=54]
 *
 * Each sheet is the system's own printable score sheet (utils/scoresheet.ts,
 * the same file the mobile app prints) for a random pair of colleges, filled
 * in the way a committee member fills it: the official result in its box,
 * plus set/game scores, quarter totals, player numbers and tally marks as
 * the clutter a real sheet carries. The handwriting is one of six
 * handwriting fonts at a random size, slant, offset and ink colour.
 *
 * Writes to e2e/ocr-accuracy/out/clean/: <id>.png (the sheet at 2x) and
 * <id>.json (ground truth: every handwritten number with its box, and the
 * official score per college). distort.py then turns these into photos.
 */
import fs from 'node:fs';
import path from 'node:path';
import { Builder } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import { buildScoreSheetHtml } from '../../src/app/utils/scoresheet';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(HERE, 'out', 'clean');
const FONTS = path.join(HERE, 'out', 'fonts');
const COUNT = Number(process.argv[2] || 54);

const COLLEGES: [string, string][] = [
  ['College of Accountancy, Business, Economics, and International Hospitality Management', 'CABEIHM'],
  ['College of Arts and Sciences', 'CAS'],
  ['College of Criminal Justice Education', 'CCJE'],
  ['College of Informatics and Computing Sciences', 'CICS'],
  ['College of Nursing and Allied Health Sciences', 'CONAHS'],
  ['College of Teacher Education', 'CTE'],
  ['Laboratory School', 'LS'],
];
const LAYOUTS = [
  { key: 'basketball', category: 'Basketball — Men', title: 'Basketball — Men (Round 1)' },
  { key: 'volleyball', category: 'Volleyball — Women', title: 'Volleyball — Women (Round 1)' },
  { key: 'beach', category: 'Beach Volleyball — Men', title: 'Beach Volleyball — Men (Round 1)' },
  { key: 'badminton', category: 'Badminton — M Singles A', title: 'Badminton — M Singles A (Round 1)' },
  { key: 'tabletennis', category: 'Table Tennis — W Doubles', title: 'Table Tennis — W Doubles (Round 1)' },
  { key: 'general', category: 'Chess — Men', title: 'Chess — Men (Round 2)' },
] as const;
const FONT_FILES: Record<string, string> = {
  Caveat: 'ofl/caveat/Caveat%5Bwght%5D.ttf', Kalam: 'ofl/kalam/Kalam-Regular.ttf',
  PatrickHand: 'ofl/patrickhand/PatrickHand-Regular.ttf', IndieFlower: 'ofl/indieflower/IndieFlower-Regular.ttf',
  GochiHand: 'ofl/gochihand/GochiHand-Regular.ttf', ShadowsIntoLight: 'ofl/shadowsintolight/ShadowsIntoLight.ttf',
};
const INKS = ['#1a2a7a', '#10204f', '#1b1b1b', '#2b2b6b', '#0d3b8c'];

/* Small deterministic random generator, so a run can be reproduced. */
let seed = 20261010;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];

/** A volleyball-style set/game score (winner reaches `to`, two clear). */
function gameScore(to: number): [number, number] {
  const loser = int(Math.max(0, to - 12), to - 2);
  return rnd() < 0.15 ? [to + 2, to] : [to, loser];
}
/** Scores of a best-of-N match, as [aPoints[], bPoints[], aWon, bWon]. */
function match(bestOf: number, to: number) {
  const need = Math.ceil(bestOf / 2);
  const a: number[] = []; const b: number[] = []; let aw = 0; let bw = 0;
  while (aw < need && bw < need) {
    const [w, l] = gameScore(to);
    if (rnd() < 0.5) { a.push(w); b.push(l); aw++; } else { a.push(l); b.push(w); bw++; }
  }
  return { a, b, aw, bw };
}

async function ensureFonts() {
  fs.mkdirSync(FONTS, { recursive: true });
  for (const [name, p] of Object.entries(FONT_FILES)) {
    const file = path.join(FONTS, `${name}.ttf`);
    if (fs.existsSync(file)) continue;
    const res = await fetch(`https://raw.githubusercontent.com/google/fonts/main/${p}`);
    if (!res.ok) throw new Error(`Could not download the ${name} font`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
}

/** Runs in the page: writes the values and returns where each one landed. */
const FILL = function (this: void, spec: any) {
  const doc = document;
  const out: any[] = [];
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const rand = (() => { let s = spec.seed; return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648); })();
  const write = (cell: Element | null, text: string, opts: { gt?: boolean; size?: number } = {}) => {
    if (!cell) return;
    (cell as HTMLElement).style.position = 'relative';
    // A cell with a printed label ("CAS:") gets the number after the label.
    const labelled = (cell.textContent || '').trim() !== '';
    const span = doc.createElement('span');
    span.textContent = text;
    const size = (opts.size ?? spec.size) * (0.9 + rand() * 0.25);
    span.style.cssText = `position:absolute;left:${labelled ? 55 + rand() * 20 : 15 + rand() * 30}%;top:50%;transform:translateY(-50%) rotate(${(rand() - 0.5) * 8}deg);` +
      `font-family:'${spec.font}';font-size:${size}px;color:${spec.ink};line-height:1;white-space:nowrap;font-weight:${spec.font === 'Caveat' ? 600 : 400};`;
    cell.appendChild(span);
    if (opts.gt !== false) {
      const r = span.getBoundingClientRect();
      out.push({ text, x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height });
    }
  };
  const rowOf = (table: Element | null, name: string) =>
    table ? [...table.querySelectorAll('tr')].find((tr) => tr.cells.length > 1 && norm(tr.cells[0].textContent || '') === norm(name)) || null : null;
  const tableWith = (needle: string) => [...doc.querySelectorAll('table')].find((t) => norm(t.textContent || '').includes(norm(needle))) || null;
  const tally = (cells: Element[], n: number) => cells.slice(0, n).forEach((c) => write(c, rand() < 0.5 ? '/' : 'x', { gt: false, size: spec.size * 0.9 }));
  const [A, B] = spec.depts;
  const v = spec.values;

  if (spec.layout === 'basketball') {
    for (const [i, name] of [A, B].entries()) {
      const tr = [...doc.querySelectorAll('td.team')].find((td) => norm(td.textContent || '') === norm(name));
      write(tr?.parentElement?.querySelector('td.score') ?? null, String(v.final[i]));
    }
    // Quarter totals in the grand-total table ("CAS: __").
    const grand = [...doc.querySelectorAll('table')].find((t) => (t.textContent || '').includes('GRAND TOTAL'));
    const qRows = grand ? [...grand.querySelectorAll('tr')].filter((tr) => /QUARTER \d/.test(tr.textContent || '')) : [];
    qRows.forEach((tr, q) => { write(tr.cells[1], String(v.quarters[0][q]), { size: spec.size * 0.7 }); write(tr.cells[2], String(v.quarters[1][q]), { size: spec.size * 0.7 }); });
    // Player numbers in both rosters, and tally marks in the running score.
    const rosterRows = [...doc.querySelectorAll('tr')].filter((tr) => tr.cells.length >= 8 && tr.cells[0].textContent?.trim() === '' && tr.cells[2]);
    rosterRows.slice(0, 10).forEach((tr, k) => write(tr.cells[2], String(v.jerseys[k % v.jerseys.length]), { size: spec.size * 0.7 }));
    const running = [...doc.querySelectorAll('td')].filter((td) => /^\d{1,3}$/.test(td.textContent?.trim() || '') && Number(td.textContent) <= 160);
    tally(running, Math.min(running.length, 30));
  } else if (spec.layout === 'volleyball') {
    for (const [i, name] of [A, B].entries()) {
      const tr = [...doc.querySelectorAll('td.team')].find((td) => norm(td.textContent || '') === norm(name));
      write(tr?.parentElement?.querySelector('td.score') ?? null, String(v.won[i]));
    }
    // Set points in the result table: P columns beside the SET column.
    const res = doc.querySelector('table.res');
    const setRows = res ? [...res.querySelectorAll('tr')].filter((tr) => /^\d/.test(tr.querySelector('td.set')?.textContent?.trim() || '')) : [];
    setRows.slice(0, v.a.length).forEach((tr, s) => {
      write(tr.cells[3], String(v.a[s]), { size: spec.size * 0.7 });
      write(tr.cells[5], String(v.b[s]), { size: spec.size * 0.7 });
    });
  } else {
    // Set/game tables: one row per college, columns named in the header.
    const header = spec.layout === 'general' ? 'OVERALL SCORE' : spec.layout === 'beach' ? 'SETS WON' : 'GAMES WON';
    const table = tableWith(header);
    const heads = table ? [...table.querySelectorAll('th')].map((th) => norm(th.textContent || '')) : [];
    const col = (label: string) => heads.findIndex((h) => h.startsWith(norm(label)));
    for (const [i, name] of [A, B].entries()) {
      const tr = rowOf(table, name);
      if (!tr) continue;
      if (spec.layout === 'general') {
        write(tr.cells[col('overall score')], String(v.final[i]));
        write(tr.cells[col('rank')], String(v.final[i] >= v.final[1 - i] ? 1 : 2), { size: spec.size * 0.8 });
      } else {
        const games = i === 0 ? v.a : v.b;
        games.forEach((g: number, k: number) => write(tr.cells[col(`${spec.layout === 'beach' ? 'set' : 'game'} ${k + 1}`)], String(g), { size: spec.size * 0.75 }));
        if (spec.layout === 'beach') {
          write(tr.cells[col('sets won')], String(v.won[i]));
          write(tr.cells[col('final')], String(v.won[i]));
        } else {
          write(tr.cells[col('games won')], String(v.won[i]));
        }
      }
    }
    // Tally marks in the point logs.
    const logCells = [...doc.querySelectorAll('td')].filter((td) => td.textContent?.trim() === '' && (td.closest('table')?.textContent || '').match(/Point-by-Point|Rally Tracker|circle point/));
    tally(logCells, Math.min(logCells.length, 40));
  }
  const second = [...doc.querySelectorAll('*')].find((el) => /teams · officials · approval/.test(el.textContent || '') && el.children.length === 0);
  // Page 1 only (a photo is of one page): up to page 2, or the last content.
  const bottom = Math.max(...[...doc.body.querySelectorAll('*')].map((el) => el.getBoundingClientRect().bottom)) + scrollY + 16;
  return { tokens: out, pageHeight: second ? second.getBoundingClientRect().top + scrollY - 8 : bottom };
};

async function main() {
  await ensureFonts();
  fs.mkdirSync(OUT, { recursive: true });
  const options = new chrome.Options().addArguments('--headless=new', '--no-sandbox', '--window-size=1100,1400', '--allow-file-access-from-files');
  if (process.env.CHROME_BIN) options.setChromeBinaryPath(process.env.CHROME_BIN);
  const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
  const manifest: any[] = [];
  try {
    for (let n = 0; n < COUNT; n++) {
      const layout = LAYOUTS[n % LAYOUTS.length];
      const i = int(0, COLLEGES.length - 1); let j = int(0, COLLEGES.length - 2); if (j >= i) j++;
      const [A, B] = [COLLEGES[i], COLLEGES[j]];
      const id = `${String(n + 1).padStart(2, '0')}-${layout.key}`;
      let values: any; let score: [number, number];
      if (layout.key === 'basketball') {
        const quarters = [[0, 0, 0, 0].map(() => int(8, 26)), [0, 0, 0, 0].map(() => int(8, 26))];
        const final = quarters.map((q) => q.reduce((s, x) => s + x, 0));
        if (final[0] === final[1]) { quarters[0][3]++; final[0]++; }
        values = { quarters, final, jerseys: Array.from({ length: 10 }, () => int(0, 99)) };
        score = final as [number, number];
      } else if (layout.key === 'general') {
        values = { final: [int(40, 100), int(40, 100)] };
        score = values.final;
      } else {
        const m = layout.key === 'volleyball' ? match(5, 25) : layout.key === 'beach' ? match(3, 21) : layout.key === 'badminton' ? match(3, 21) : match(5, 11);
        values = { a: m.a, b: m.b, won: [m.aw, m.bw] };
        score = [m.aw, m.bw];
      }
      const html = buildScoreSheetHtml({
        id: `sheet-${id}`, name: `${layout.title}: ${A[1]} vs ${B[1]}`, category: layout.category,
        schedule: `2026-10-${String(int(12, 30)).padStart(2, '0')}`, startTime: `${int(8, 16)}:00`, venueName: pick(['University Gymnasium', 'Covered Court', 'Function Hall', 'Badminton Hall — Court 1']),
        departments: [A[0], B[0]], teamLabels: [A[1], B[1]],
      } as any);
      const font = pick(Object.keys(FONT_FILES));
      const face = Object.keys(FONT_FILES).map((f) => `@font-face{font-family:'${f}';src:url('file://${FONTS}/${f}.ttf')}`).join('');
      const file = path.join(OUT, `${id}.html`);
      fs.writeFileSync(file, html.replace('</head>', `<style>${face}</style></head>`));
      await driver.sendDevToolsCommand('Emulation.setDeviceMetricsOverride', { width: 1100, height: 1400, deviceScaleFactor: 1, mobile: false });
      await driver.get(`file://${file}`);
      await driver.executeAsyncScript('const done = arguments[arguments.length - 1]; document.fonts.load("20px ' + font + '").then(() => document.fonts.ready).then(() => done())');
      const spec = { layout: layout.key, depts: [A[0], B[0]], values, font, ink: pick(INKS), size: int(20, 26), seed: int(1, 1e9) };
      const res: any = await driver.executeScript(`return (${FILL.toString()})(arguments[0]);`, spec);
      const height = Math.ceil(res.pageHeight);
      const shot: any = await driver.sendAndGetDevToolsCommand('Page.captureScreenshot', {
        format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1100, height, scale: 2 },
      });
      fs.writeFileSync(path.join(OUT, `${id}.png`), Buffer.from(shot.data, 'base64'));
      const gt = {
        id, layout: layout.key, font, departments: [A[0], B[0]], abbreviations: [A[1], B[1]],
        scores: { [A[0]]: score[0], [B[0]]: score[1] },
        tokens: res.tokens.filter((t: any) => t.y + t.h <= height).map((t: any) => ({ text: t.text, box: [t.x * 2, t.y * 2, (t.x + t.w) * 2, (t.y + t.h) * 2] })),
      };
      fs.writeFileSync(path.join(OUT, `${id}.json`), JSON.stringify(gt, null, 2));
      fs.rmSync(file);
      manifest.push({ id, layout: layout.key, tokens: gt.tokens.length });
      process.stdout.write(`\r${n + 1}/${COUNT} ${id}            `);
    }
  } finally {
    await driver.quit();
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nWrote ${manifest.length} sheets to ${path.relative(process.cwd(), OUT)}`);
}

main();
