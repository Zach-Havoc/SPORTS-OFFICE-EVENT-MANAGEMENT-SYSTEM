// ─────────────────────────────────────────────────────────────────────────────
// FIBA-style basketball scoresheet — printable HTML.
//
// KEEP IN SYNC: this file exists twice, byte for byte —
//   SportAxisWeb/src/app/utils/basketballScoresheet.ts   (web admin print)
//   SportAxisApp/src/utils/basketballScoresheet.ts       (mobile print / PDF)
// It has no imports, so the same file works in both apps.
//
// Layout follows the office's FIBA-style template: header (teams, date, time,
// location, umpires); per team — time-outs, team fouls per quarter, free
// throws, 12 players with licence no., jersey no., "player in" and fouls 1–5,
// coach / assistant coach fouls; running score 1–160 for both teams;
// officials; the winner; the grand total per quarter.
//
// Printed on long bond paper (8.5 x 13in), portrait.
//
// Read back by OCR (OcrController::matchScoresToDepartments): it finds the
// FIRST line holding a college's full name and takes the first 0–100 number
// to its right on the same row. So a college's full name is printed exactly
// once — in the FINAL SCORE strip under the running score, one row per team,
// the score box right beside it, on one line — and short labels (CICS, CTE…)
// are used everywhere else, including in the event title. The strip sits
// above the officials / victorious-team boxes so nothing handwritten there
// can come first.
// ─────────────────────────────────────────────────────────────────────────────

export interface BasketballSheetEvent {
  name: string;
  schedule?: string | null;
  startTime?: string | null;
  venueName?: string | null;
  departments?: string[] | null;
}

const STOPWORDS = /^(of|and|the|for|in|at|de|del|la|y)$/i;

/** "College of Arts and Sciences" → "CAS". A short name is kept as it is. */
function acronym(name: string): string {
  if (name.length <= 10) return name;
  return name
    .split(/[\s,&/().-]+/)
    .filter((w) => w && !STOPWORDS.test(w))
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function fmtDate(schedule?: string | null): string {
  if (!schedule) return '';
  const d = new Date(schedule);
  return isNaN(d.getTime())
    ? String(schedule)
    : d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtTime(t?: string | null): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t ?? '');
  if (!m) return '';
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

const boxes = (labels: Array<string | number>) =>
  `<span class="boxes">${labels.map((l) => `<span class="box">${l}</span>`).join('')}</span>`;

function teamPanel(side: string, short: string): string {
  const players = Array.from({ length: 12 })
    .map(() => `<tr class="p"><td></td><td></td><td class="no"></td><td></td>${'<td></td>'.repeat(5)}</tr>`)
    .join('');
  const coachRow = (label: string) =>
    `<tr class="p"><td colspan="6" class="lbl">${label}</td><td></td><td></td><td></td></tr>`;

  return `
    <div class="panel">
      <div class="bar">${side} &nbsp;·&nbsp; ${esc(short)}</div>
      <table class="tf">
        <tr>
          <td class="h">TIME-OUTS</td><td></td><td class="h" colspan="4">TEAM FOULS</td>
        </tr>
        <tr>
          <td>${boxes([1, 2])}</td><td class="s">1ST HALF</td>
          <td class="q">Q1</td><td>${boxes([1, 2, 3, 4, 5])}</td>
          <td class="q">Q2</td><td>${boxes([1, 2, 3, 4, 5])}</td>
        </tr>
        <tr>
          <td>${boxes([1, 2, 3])}</td><td class="s">2ND HALF</td>
          <td class="q">Q3</td><td>${boxes([1, 2, 3, 4, 5])}</td>
          <td class="q">Q4</td><td>${boxes([1, 2, 3, 4, 5])}</td>
        </tr>
        <tr>
          <td>${boxes(['', '', ''])}</td><td class="s">OVERTIME</td>
          <td class="q" colspan="2" style="text-align:right;">FREE THROW&nbsp;</td><td colspan="2">${boxes(['', '', '', '', ''])}</td>
        </tr>
      </table>
      <table class="players">
        <colgroup>
          <col style="width:13%"><col><col style="width:7%"><col style="width:9%">
          <col style="width:5.6%"><col style="width:5.6%"><col style="width:5.6%"><col style="width:5.6%"><col style="width:5.6%">
        </colgroup>
        <tr class="head">
          <th rowspan="2">LICENSE<br>NO.</th><th rowspan="2">PLAYER NAME</th><th rowspan="2" class="no">NO.</th>
          <th rowspan="2">PLAYER<br>IN</th><th colspan="5">FOULS</th>
        </tr>
        <tr class="head"><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th></tr>
        ${players}
        ${coachRow('HEAD COACH')}
        ${coachRow('ASSISTANT COACH')}
      </table>
    </div>`;
}

function runningScore(homeShort: string, awayShort: string): string {
  const blocks = 4;
  const rows = 40;
  const head = Array.from({ length: blocks })
    .map((_, b) => `<th colspan="2" class="${b ? 'sep' : ''}">${esc(homeShort)}</th><th colspan="2">${esc(awayShort)}</th>`)
    .join('');
  const body = Array.from({ length: rows })
    .map((_, r) => `<tr>${Array.from({ length: blocks })
      .map((_, b) => {
        const n = b * rows + r + 1;
        return `<td class="${b ? 'sep' : ''}"></td><td class="n">${n}</td><td class="n">${n}</td><td></td>`;
      })
      .join('')}</tr>`)
    .join('');

  return `
    <table class="run">
      <tr><th colspan="${blocks * 4}" class="title">RUNNING SCORE</th></tr>
      <tr class="teams">${head}</tr>
      ${body}
    </table>`;
}

/**
 * `labels` are the teams' short names (e.g. from the departments list:
 * "CICS"); without them the initials of each college's name are used.
 */
export function buildBasketballScoresheetHtml(event: BasketballSheetEvent, labels: Array<string | null | undefined> = []): string {
  const depts = event.departments ?? [];
  const home = depts[0] || 'TEAM HOME';
  const away = depts[1] || 'TEAM AWAY';
  // Never the full name as a label: it must appear only in the FINAL SCORE strip.
  const shortOf = (full: string, label?: string | null) => (label && label !== full ? label : acronym(full));
  const homeShort = shortOf(home, labels[0]);
  const awayShort = shortOf(away, labels[1]);

  // The event title names the teams too — swap in the short labels.
  let title = event.name || '';
  for (const [full, short] of [[home, homeShort], [away, awayShort]]) {
    if (full) title = title.split(full).join(short);
  }

  const grand = ['QUARTER 1', 'QUARTER 2', 'QUARTER 3', 'QUARTER 4', 'OVERTIME(S)']
    .map((q) => `<tr><td class="lbl">${q}</td><td>${esc(homeShort)}:</td><td>${esc(awayShort)}:</td></tr>`)
    .join('');

  const officials = [
    ['HEAD COACH', 'TIMER'],
    ['ASSISTANT COACH', 'CREW CHIEF'],
    ['SCORER', 'UMPIRE 1'],
    ['SHOT CLOCK OPERATOR', 'UMPIRE 2'],
  ].map(([a, b]) => `<tr><td>${a}:</td><td>${b}:</td></tr>`).join('');

  const finalRow = (full: string, rowspanLabel: boolean) => `
    <tr>
      ${rowspanLabel ? '<td class="fl" rowspan="2">FINAL<br>SCORE</td>' : ''}
      <td class="team">${esc(full)}</td>
      <td class="score"></td>
    </tr>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Basketball Scoresheet</title>
<style>
  @page { size: 8.5in 13in; margin: 7mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; font-size: 8.5pt; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1pt solid #000; padding: 0 3pt; font-weight: normal; }
  .top { display: flex; align-items: flex-end; justify-content: space-between; gap: 8pt; margin-bottom: 5pt; }
  h1 { font-size: 17pt; font-weight: 900; letter-spacing: 0.2pt; line-height: 1; white-space: nowrap; }
  .org { text-align: right; font-size: 7.5pt; color: #444; line-height: 1.35; }
  .org b { color: #111; font-size: 8pt; }
  .meta td { height: 17pt; font-size: 7.5pt; font-weight: bold; vertical-align: middle; }
  .meta td span { font-weight: normal; font-size: 8.5pt; margin-left: 3pt; }
  .main { display: flex; gap: 6pt; margin-top: 6pt; align-items: flex-start; }
  .left { flex: 1.08; min-width: 0; display: flex; flex-direction: column; gap: 6pt; }
  .right { flex: 1; min-width: 0; }
  .panel { border: 1pt solid #000; }
  .bar, .run th.title, .gt th { background: #e5e7eb; font-weight: bold; font-size: 8.5pt; padding: 3pt 4pt; border-bottom: 1pt solid #000; }
  .run th.title, .gt th { text-align: center; }
  .tf td { border: none; padding: 1.5pt 3pt; font-size: 7.5pt; white-space: nowrap; }
  .tf td.h { font-weight: bold; font-size: 7.5pt; }
  .tf td.s { font-size: 6.5pt; color: #333; }
  .tf td.q { font-size: 7.5pt; text-align: right; }
  .boxes { display: inline-flex; border: 1pt solid #000; }
  .box { width: 11pt; height: 11pt; border-left: 1pt solid #000; font-size: 6.5pt; text-align: center; line-height: 11pt; }
  .box:first-child { border-left: none; }
  .players { border-top: 1pt solid #000; }
  .players td, .players th { border-left: 1pt solid #000; border-right: none; }
  .players td:first-child, .players th:first-child { border-left: none; }
  .players tr:last-child td { border-bottom: none; }
  .players .head th { font-size: 7pt; text-align: center; height: 11pt; }
  .players tr.p td { height: 15.5pt; }
  .players .no { background: #e5e7eb; }
  .players td.lbl { font-size: 7pt; vertical-align: middle; }
  .run { table-layout: fixed; }
  .run td, .run th { text-align: center; padding: 0; overflow: hidden; }
  .run tr.teams th { font-size: 5.5pt; font-weight: bold; height: 11pt; white-space: nowrap; }
  .run td { height: 13.2pt; font-size: 7pt; width: 6.25%; }
  .run td.n { background: #e5e7eb; }
  .run .sep { border-left: 2pt solid #000; }
  .bottom { display: flex; gap: 6pt; margin-top: 6pt; align-items: stretch; }
  .officials td { height: 17pt; font-size: 7.5pt; font-weight: bold; width: 50%; }
  .winner { border: 1pt solid #000; border-top: none; height: 26pt; padding: 0 3pt; display: flex; align-items: center; font-size: 8.5pt; font-weight: bold; }
  .gt td { height: 17pt; font-size: 7.5pt; }
  .gt td.lbl { font-weight: bold; width: 30%; }
  .final { margin-top: 6pt; }
  .bottom { margin-bottom: 0; }
  .final td { height: 26pt; vertical-align: middle; }
  .final td.fl { width: 12%; text-align: center; font-weight: 900; font-size: 9pt; background: #e5e7eb; line-height: 1.15; }
  .final td.team { font-size: 9pt; font-weight: bold; white-space: nowrap; }
  .final td.score { width: 16%; }
  .foot { display: flex; justify-content: space-between; font-size: 6.5pt; color: #6b7280; margin-top: 3pt; }
  @media print { .bar, .run th.title, .gt th, .players .no, .run td.n, .final td.fl { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
  <div class="top">
    <h1>FIBA-STYLE BASKETBALL SCORESHEET</h1>
    <div class="org"><b>SportAxis · Sports Office</b><br>${esc(title)}</div>
  </div>

  <table class="meta">
    <tr>
      <td style="width:33%">TEAM HOME<span>${esc(homeShort)}</span></td>
      <td style="width:22%">DATE<span>${esc(fmtDate(event.schedule))}</span></td>
      <td style="width:17%">TIME<span>${esc(fmtTime(event.startTime))}</span></td>
      <td>LOCATION<span>${esc(event.venueName || '')}</span></td>
    </tr>
  </table>
  <table class="meta" style="border-top:none">
    <tr>
      <td style="width:33%;border-top:none">TEAM AWAY<span>${esc(awayShort)}</span></td>
      <td style="width:39%;border-top:none">UMPIRE 1</td>
      <td style="border-top:none">UMPIRE 2</td>
    </tr>
  </table>

  <div class="main">
    <div class="left">
      ${teamPanel('TEAM HOME', homeShort)}
      ${teamPanel('TEAM AWAY', awayShort)}
    </div>
    <div class="right">${runningScore(homeShort, awayShort)}</div>
  </div>

  <table class="final">
    ${finalRow(home, true)}
    ${finalRow(away, false)}
  </table>

  <div class="bottom">
    <div style="flex:1.08; min-width:0;">
      <table class="officials">${officials}</table>
      <div class="winner">VICTORIOUS TEAM:<span style="font-weight:normal;font-size:7pt;color:#555;margin-left:4pt;">(short name, e.g. ${esc(homeShort)})</span></div>
    </div>
    <div style="flex:1; min-width:0;">
      <table class="gt">
        <tr><th colspan="3">GRAND TOTAL</th></tr>
        ${grand}
      </table>
    </div>
  </div>

  <div class="foot"><span>Write each team's final score in its box beside the team name — this strip is what the office scans.</span><span>SportAxis © ${new Date().getFullYear()} · For official use only</span></div>
</body></html>`;
}
