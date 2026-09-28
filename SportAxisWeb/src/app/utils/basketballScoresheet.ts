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

/**
 * A game recorded in the app — GET /api/events/{id}/scoresheet. With it the
 * sheet comes out filled in: rosters, fouls, team fouls, the running score,
 * quarter scores, the final, the winner and the officials.
 */
export interface FilledBasketballGame {
  status?: string;
  umpires?: string[];
  winner?: number | null;
  teams: Array<{
    score: number;
    coach?: string | null;
    periodScores: Array<{ period: number; label: string; points: number }>;
    /** Fouls per quarter, keyed "1"–"4" (overtime counts with the 4th). */
    teamFouls: Record<string, number>;
    players: Array<{
      jersey?: string | null;
      name: string;
      licence?: string | null;
      starter: boolean;
      played: boolean;
      /** Each foul's period, in order: "Q1"…"Q4", "OT1"… */
      fouls: string[];
    }>;
  }>;
  /** Every scoring play, in order. side 0 = home, 1 = away. */
  plays: Array<{ side: number; points: number; jersey?: string | null; period: number }>;
  regulationPeriods?: number;
}

type Team = FilledBasketballGame['teams'][number];

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

/** A row of boxes; the first `marked` are crossed off (team fouls taken). */
const boxes = (labels: Array<string | number>, marked = 0) =>
  `<span class="boxes">${labels.map((l, i) => `<span class="box${i < marked ? ' x' : ''}">${l}</span>`).join('')}</span>`;

function teamPanel(side: string, short: string, team?: Team): string {
  const roster = team?.players ?? [];
  const players = Array.from({ length: Math.max(12, roster.length) })
    .map((_, i) => {
      const p = roster[i];
      if (!p) return `<tr class="p"><td></td><td></td><td class="no"></td><td></td>${'<td></td>'.repeat(5)}</tr>`;
      // FIBA: an X for every player who got in; the starting five's X circled.
      const inMark = p.starter ? '<span class="in starter">X</span>' : p.played ? '<span class="in">X</span>' : '';
      const fouls = Array.from({ length: 5 }).map((_, k) => `<td class="foul">${p.fouls[k] ? esc(p.fouls[k]) : ''}</td>`).join('');
      return `<tr class="p filled"><td class="lic">${esc(p.licence ?? '')}</td><td class="nm">${esc(p.name)}</td><td class="no">${esc(p.jersey ?? '')}</td><td class="c">${inMark}</td>${fouls}</tr>`;
    })
    .join('');
  const tf = (q: number) => team?.teamFouls?.[String(q)] ?? 0;
  const coachRow = (label: string, name?: string | null) =>
    `<tr class="p"><td colspan="6" class="lbl">${label}${name ? `<span class="v">${esc(name)}</span>` : ''}</td><td></td><td></td><td></td></tr>`;

  return `
    <div class="panel">
      <div class="bar">${side} &nbsp;·&nbsp; ${esc(short)}</div>
      <table class="tf">
        <tr>
          <td class="h">TIME-OUTS</td><td></td><td class="h" colspan="4">TEAM FOULS</td>
        </tr>
        <tr>
          <td>${boxes([1, 2])}</td><td class="s">1ST HALF</td>
          <td class="q">Q1</td><td>${boxes([1, 2, 3, 4, 5], tf(1))}</td>
          <td class="q">Q2</td><td>${boxes([1, 2, 3, 4, 5], tf(2))}</td>
        </tr>
        <tr>
          <td>${boxes([1, 2, 3])}</td><td class="s">2ND HALF</td>
          <td class="q">Q3</td><td>${boxes([1, 2, 3, 4, 5], tf(3))}</td>
          <td class="q">Q4</td><td>${boxes([1, 2, 3, 4, 5], tf(4))}</td>
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
        ${coachRow('HEAD COACH', team?.coach)}
        ${coachRow('ASSISTANT COACH')}
      </table>
    </div>`;
}

interface Mark { kind: 'fg' | 'fg3' | 'ft'; jersey: string; quarterEnd: boolean }

/**
 * Each team's running-score marks, by total reached, the FIBA way: a basket
 * slashes the new total and the scorer's jersey goes beside it (circled for
 * a three); a free throw is a filled dot; the last total of each quarter is
 * underlined.
 */
function runningMarks(game?: FilledBasketballGame): Array<Map<number, Mark>> {
  const marks = [new Map<number, Mark>(), new Map<number, Mark>()];
  const totals = [0, 0];
  const lastOfPeriod: Array<Map<number, number>> = [new Map(), new Map()];
  for (const p of game?.plays ?? []) {
    if (p.side !== 0 && p.side !== 1) continue;
    totals[p.side] += p.points;
    marks[p.side].set(totals[p.side], {
      kind: p.points === 1 ? 'ft' : p.points === 3 ? 'fg3' : 'fg',
      jersey: p.jersey ?? '–',
      quarterEnd: false,
    });
    lastOfPeriod[p.side].set(p.period, totals[p.side]);
  }
  [0, 1].forEach((side) => {
    for (const total of lastOfPeriod[side].values()) {
      const m = marks[side].get(total);
      if (m) m.quarterEnd = true;
    }
  });
  return marks;
}

function runningScore(homeShort: string, awayShort: string, game?: FilledBasketballGame): string {
  const blocks = 4;
  const rows = 40;
  const [homeMarks, awayMarks] = runningMarks(game);
  const cells = (n: number, sep: string) => {
    const h = homeMarks.get(n);
    const a = awayMarks.get(n);
    const q = (m?: Mark) => (m?.quarterEnd ? ' qend' : '');
    const jersey = (m?: Mark) => (m && m.kind !== 'ft' ? `<span class="j${m.kind === 'fg3' ? ' three' : ''}">${esc(m.jersey)}</span>` : '');
    return `<td class="${sep}${q(h)}">${jersey(h)}</td>`
      + `<td class="n${h ? ` ${h.kind === 'ft' ? 'ft' : 'fg'}` : ''}${q(h)}">${n}</td>`
      + `<td class="n${a ? ` ${a.kind === 'ft' ? 'ft' : 'fg'}` : ''}${q(a)}">${n}</td>`
      + `<td class="${q(a).trim()}">${jersey(a)}</td>`;
  };
  const head = Array.from({ length: blocks })
    .map((_, b) => `<th colspan="2" class="${b ? 'sep' : ''}">${esc(homeShort)}</th><th colspan="2">${esc(awayShort)}</th>`)
    .join('');
  const body = Array.from({ length: rows })
    .map((_, r) => `<tr>${Array.from({ length: blocks })
      .map((_, b) => {
        return cells(b * rows + r + 1, b ? 'sep' : '');
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
export function buildBasketballScoresheetHtml(
  event: BasketballSheetEvent,
  labels: Array<string | null | undefined> = [],
  game?: FilledBasketballGame,
): string {
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

  const reg = game?.regulationPeriods ?? 4;
  const [homeTeam, awayTeam] = game?.teams ?? [];
  const periodPoints = (team: Team | undefined, q: number) => {
    if (!team) return '';
    const rows = team.periodScores.filter((p) => (q <= reg ? p.period === q : p.period > reg));
    if (q > reg && rows.length === 0) return '';
    return String(rows.reduce((sum, p) => sum + p.points, 0));
  };
  const grand = ['QUARTER 1', 'QUARTER 2', 'QUARTER 3', 'QUARTER 4', 'OVERTIME(S)']
    .map((label, i) => `<tr><td class="lbl">${label}</td><td>${esc(homeShort)}: <b>${periodPoints(homeTeam, i + 1)}</b></td><td>${esc(awayShort)}: <b>${periodPoints(awayTeam, i + 1)}</b></td></tr>`)
    .join('');
  const umpires = game?.umpires ?? [];
  const winner = game?.winner === 0 ? homeShort : game?.winner === 1 ? awayShort : '';
  const final = game?.status === 'finished';

  // What the app knows about who ran the game; the rest stays blank to fill by hand.
  const known: Record<string, string> = game
    ? { SCORER: esc(umpires[0] ?? ''), 'UMPIRE 1': esc(umpires[0] ?? ''), 'UMPIRE 2': esc(umpires[1] ?? '') }
    : {};
  const val = (label: string) => (known[label] ? `<span class="v">${known[label]}</span>` : '');
  const officials = [
    ['HEAD COACH', 'TIMER'],
    ['ASSISTANT COACH', 'CREW CHIEF'],
    ['SCORER', 'UMPIRE 1'],
    ['SHOT CLOCK OPERATOR', 'UMPIRE 2'],
  ].map(([a, b]) => `<tr><td>${a}:${val(a)}</td><td>${b}:${val(b)}</td></tr>`).join('');

  const finalRow = (full: string, rowspanLabel: boolean, team?: Team) => `
    <tr>
      ${rowspanLabel ? '<td class="fl" rowspan="2">FINAL<br>SCORE</td>' : ''}
      <td class="team">${esc(full)}</td>
      <td class="score">${team ? team.score : ''}</td>
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
  .box.x { background: #111; color: #fff; }
  .players tr.filled td { font-size: 7pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 0; }
  .players tr.filled td.nm { font-size: 7.5pt; }
  .players td.c, .players td.foul { text-align: center; }
  .players td.foul { font-size: 6.5pt; }
  .in { font-weight: bold; }
  .in.starter { display: inline-block; width: 11pt; height: 11pt; line-height: 10pt; border: 1pt solid #000; border-radius: 50%; }
  .run td.n.fg { background: linear-gradient(to top right, #e5e7eb calc(50% - 0.8pt), #000 calc(50% - 0.8pt), #000 calc(50% + 0.8pt), #e5e7eb calc(50% + 0.8pt)); font-weight: bold; }
  .run td.n.ft { background: #e5e7eb; }
  .run td.n.ft::before { content: '●'; }
  .run td.n.ft { font-size: 0; }
  .run td.n.ft::before { font-size: 8pt; }
  .run td .j { font-size: 6.5pt; font-weight: bold; }
  .run td .j.three { display: inline-block; min-width: 10pt; border: 0.8pt solid #000; border-radius: 50%; line-height: 9pt; }
  .run td.qend { border-bottom: 2pt solid #000; }
  .v { font-weight: normal; margin-left: 3pt; font-size: 7pt; }
  .officials td { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 0; }
  .stamp { display: inline-block; margin-top: 2pt; padding: 1pt 4pt; border: 1pt solid #111; font-weight: bold; font-size: 7pt; color: #111; }
  .stamp.draft { border-style: dashed; color: #92400e; border-color: #92400e; }
  .final td.score { text-align: center; font-size: 16pt; font-weight: 900; }
  .foot { display: flex; justify-content: space-between; font-size: 6.5pt; color: #6b7280; margin-top: 3pt; }
  @media print { .bar, .run th.title, .gt th, .players .no, .run td.n, .final td.fl, .box.x { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
  <div class="top">
    <h1>FIBA-STYLE BASKETBALL SCORESHEET</h1>
    <div class="org"><b>SportAxis · Sports Office</b><br>${esc(title)}${game
      ? `<br><span class="stamp${final ? '' : ' draft'}">${final ? 'OFFICIAL RECORD — scored in the SportAxis app' : 'GAME IN PROGRESS — NOT FINAL'}</span>`
      : ''}</div>
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
      <td style="width:39%;border-top:none">UMPIRE 1<span>${esc(umpires[0] ?? '')}</span></td>
      <td style="border-top:none">UMPIRE 2<span>${esc(umpires[1] ?? '')}</span></td>
    </tr>
  </table>

  <div class="main">
    <div class="left">
      ${teamPanel('TEAM HOME', homeShort, homeTeam)}
      ${teamPanel('TEAM AWAY', awayShort, awayTeam)}
    </div>
    <div class="right">${runningScore(homeShort, awayShort, game)}</div>
  </div>

  <table class="final">
    ${finalRow(home, true, homeTeam)}
    ${finalRow(away, false, awayTeam)}
  </table>

  <div class="bottom">
    <div style="flex:1.08; min-width:0;">
      <table class="officials">${officials}</table>
      <div class="winner">VICTORIOUS TEAM:${winner
        ? `<span class="v" style="font-size:10pt;">${esc(winner)}</span>`
        : `<span style="font-weight:normal;font-size:7pt;color:#555;margin-left:4pt;">(short name, e.g. ${esc(homeShort)})</span>`}</div>
    </div>
    <div style="flex:1; min-width:0;">
      <table class="gt">
        <tr><th colspan="3">GRAND TOTAL</th></tr>
        ${grand}
      </table>
    </div>
  </div>

  <div class="foot"><span>${game
    ? `From the game recorded in SportAxis — / basket · ● free throw · ◯ three · underline: end of quarter. Time-outs aren't recorded.`
    : `Write each team's final score in its box beside the team name — this strip is what the office scans.`}</span><span>SportAxis © ${new Date().getFullYear()} · For official use only</span></div>
</body></html>`;
}
