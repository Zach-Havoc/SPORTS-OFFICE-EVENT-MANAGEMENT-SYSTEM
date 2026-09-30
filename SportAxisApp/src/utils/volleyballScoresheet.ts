// ─────────────────────────────────────────────────────────────────────────────
// FIVB-style volleyball scoresheet — printable HTML.
//
// KEEP IN SYNC: this file exists twice, byte for byte —
//   SportAxisWeb/src/app/utils/volleyballScoresheet.ts   (web admin print)
//   SportAxisApp/src/utils/volleyballScoresheet.ts       (mobile print / PDF)
// It has no imports, so the same file works in both apps.
//
// Follows the FIVB international scoresheet, on long bond paper (8.5 x 13in)
// landscape, in two pages:
//   1. the sets — per team: service order I–VI, starting players,
//      substitutes and the score at the change, service rounds, points 1–48,
//      time-outs; start and end times — then the results (T, S, W, P, set
//      durations), the winner and the final-result strip
//   2. the teams' players, coaches, officials, approval, sanctions, remarks
// Team A plays on the left in sets 1, 3 and 5, team B in sets 2 and 4 (the
// teams change sides after each set).
//
// Read back by OCR (OcrController::matchScoresToDepartments): it takes the
// FIRST line holding a college's full name and the first 0–100 number on
// that row. So a college's full name appears exactly once — in the MATCH
// RESULT strip, with the sets-won box beside it — and short names (CICS…)
// are used everywhere else.
// ─────────────────────────────────────────────────────────────────────────────

export interface VolleyballSheetEvent {
  name: string;
  category?: string | null;
  schedule?: string | null;
  startTime?: string | null;
  venueName?: string | null;
  departments?: string[] | null;
}

/** One service-round box: the team's score when that server lost the serve. */
type Round = { score?: number; last?: boolean; x?: boolean } | null;

/**
 * A match recorded in the app — GET /api/events/{id}/volleyball/scoresheet.
 * Side 0 is team A (the home side), 1 is team B.
 */
export interface FilledVolleyballGame {
  status?: string;
  bestOf?: number;
  umpires?: string[];
  winner?: number | null;
  teams: Array<{
    setsWon: number;
    coach?: string | null;
    players: Array<{ jersey?: string | null; name: string; licence?: string | null }>;
  }>;
  sets: Array<{
    number: number;
    target: number;
    firstServer: number;
    startedAt?: string | null;
    endedAt?: string | null;
    winner?: number | null;
    teams: Array<{
      points: number;
      /** Jerseys in positions I–VI, or null when the set had no rotation. */
      starting: Array<string | null> | null;
      subs: Array<{ column: number | null; jersey?: string | null; score: string }>;
      /** Per position I–VI, the service rounds in order. */
      rounds: Round[][];
      /** The score ("own:opp") at each time-out. */
      timeouts: string[];
    }>;
  }>;
}

const STOPWORDS = /^(of|and|the|for|in|at|de|del|la|y)$/i;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

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
  return isNaN(d.getTime()) ? String(schedule) : d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtTime(t?: string | null): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t ?? '');
  if (!m) return '';
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "16:02" — a set's start or end, in the device's time zone. */
function hhmm(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const minutes = (from?: string | null, to?: string | null) =>
  from && to ? Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 60000)) : null;

type SetTeam = FilledVolleyballGame['sets'][number]['teams'][number];

/** One team's half of a set block. */
function half(opts: {
  short: string;
  letter: 'A' | 'B';
  showLabels: boolean;
  timeLabel: 'START' | 'END';
  time: string;
  serveFirst: boolean | null;
  maxPoints: number;
  team?: SetTeam;
}): string {
  const { team } = opts;
  const rounds = 8;
  const cols = ROMAN.map((_, c) => c);
  const cell = (inner: string, cls = '') => `<td class="${cls}">${inner}</td>`;
  const label = (text: string) => (opts.showLabels ? `<td class="lbl">${text}</td>` : '');

  const subsIn = (c: number) => (team?.subs ?? []).filter((s) => s.column === c);
  const box = (r: Round | undefined) => {
    if (!r) return '';
    if (r.x) return '<span class="x">✕</span>';
    return r.last ? `<span class="last">${r.score}</span>` : String(r.score ?? '');
  };
  const serviceRows = Array.from({ length: rounds })
    .map((_, i) => `<tr class="rd">${label(i === 0 ? 'Service<br>rounds' : '')}${cols.map((c) => cell(box(team?.rounds?.[c]?.[i]), 'b')).join('')}</tr>`)
    .join('');

  // Points 1–48 (1–30 in a deciding set), 4 columns of 12; scored ones slashed.
  const per = 12;
  const pointCols = Math.ceil(opts.maxPoints / per);
  const points = Array.from({ length: per })
    .map((_, r) => `<tr>${Array.from({ length: pointCols })
      .map((_, c) => {
        const n = c * per + r + 1;
        if (n > opts.maxPoints) return '<td class="pt"></td>';
        const scored = team && n <= team.points;
        const final = team && n === team.points;
        return `<td class="pt${scored ? ' hit' : ''}${final ? ' fin' : ''}">${n}</td>`;
      })
      .join('')}</tr>`)
    .join('');
  const tBoxes = [0, 1].map((i) => `<td class="t">${esc(team?.timeouts?.[i] ?? '')}</td>`).join('');

  const sr = (which: 'S' | 'R') =>
    `<span class="sr${opts.serveFirst === (which === 'S') ? ' on' : ''}">${which}</span>`;

  return `
    <div class="half">
      <div class="hh">
        <span class="tm">${opts.timeLabel}<b>${esc(opts.time)}</b></span>
        <span class="team"><span class="ab">${opts.letter}</span>${esc(opts.short)}</span>
        ${sr('S')}${sr('R')}
      </div>
      <div class="hbody">
        <table class="grid">
          <tr class="ord">${label('Service order')}${cols.map((c) => cell(ROMAN[c], 'h')).join('')}</tr>
          <tr>${label('Starting players')}${cols.map((c) => cell(esc(team?.starting?.[c] ?? ''), 'st')).join('')}</tr>
          <tr>${label('Substitute')}${cols.map((c) => cell(esc(subsIn(c).map((s) => s.jersey ?? '?').join(' / ')))).join('')}</tr>
          <tr>${label('Score at change')}${cols.map((c) => cell(esc(subsIn(c).map((s) => s.score).join(' / ')), 'sc')).join('')}</tr>
          ${serviceRows}
        </table>
        <div class="pts">
          <table class="pgrid"><tr><th colspan="${pointCols}">POINTS</th></tr>${points}</table>
          <table class="tgrid"><tr><th>"T"</th><th>"T"</th></tr><tr>${tBoxes}</tr></table>
        </div>
      </div>
    </div>`;
}

function setBlock(n: number, shorts: [string, string], game?: FilledVolleyballGame): string {
  const set = game?.sets.find((s) => s.number === n);
  // A left in sets 1, 3 and 5; B left in 2 and 4.
  const leftSide = n % 2 === 1 ? 0 : 1;
  const sides = [leftSide, 1 - leftSide];
  const maxPoints = n === 5 ? 30 : 48;
  const halves = sides
    .map((side, i) => half({
      short: shorts[side],
      letter: side === 0 ? 'A' : 'B',
      showLabels: i === 0,
      timeLabel: i === 0 ? 'START' : 'END',
      time: i === 0 ? hhmm(set?.startedAt) : hhmm(set?.endedAt),
      serveFirst: set ? set.firstServer === side : null,
      maxPoints,
      team: set?.teams[side],
    }))
    .join('');

  return `
    <div class="set">
      <div class="setno"><span>SET</span><b>${n}</b></div>
      ${halves}
    </div>`;
}

/**
 * `labels` are the teams' short names (from the departments list: "CICS");
 * without them the initials of each college's name are used. With `game`,
 * the sheet comes out filled in from the match recorded in the app.
 */
export function buildVolleyballScoresheetHtml(
  event: VolleyballSheetEvent,
  labels: Array<string | null | undefined> = [],
  game?: FilledVolleyballGame,
): string {
  const depts = event.departments ?? [];
  const teamA = depts[0] || 'TEAM A';
  const teamB = depts[1] || 'TEAM B';
  // Never the full name as a label: it must appear only in the MATCH RESULT strip.
  const shortOf = (full: string, label?: string | null) => (label && label !== full ? label : acronym(full));
  const shorts: [string, string] = [shortOf(teamA, labels[0]), shortOf(teamB, labels[1])];

  let title = event.name || '';
  for (const [full, short] of [[teamA, shorts[0]], [teamB, shorts[1]]]) {
    if (full) title = title.split(full).join(short);
  }
  const division = /\bwomen\b|\bw (singles|doubles)\b/i.test(`${event.category} ${event.name}`)
    ? 'Women'
    : /\bmen\b/i.test(`${event.category} ${event.name}`) ? 'Men' : '';
  const check = (on: boolean) => `<span class="ck">${on ? '✕' : ''}</span>`;

  // Results, per set: T S W P | duration | P W S T.
  const sets = game?.sets ?? [];
  const row = (n: number) => {
    const s = sets.find((x) => x.number === n);
    const side = (i: number) => {
      const t = s?.teams[i];
      const w = s && s.winner !== null && s.winner !== undefined ? (s.winner === i ? '1' : '0') : '';
      return { T: t ? String(t.timeouts.length) : '', S: t ? String(t.subs.length) : '', W: w, P: t ? String(t.points) : '' };
    };
    const a = side(0);
    const b = side(1);
    const d = minutes(s?.startedAt, s?.endedAt);
    return `<tr><td>${a.T}</td><td>${a.S}</td><td>${a.W}</td><td class="p">${a.P}</td><td class="set">${n} <span class="dur">(${d ?? '&nbsp;&nbsp;&nbsp;'})</span></td><td class="p">${b.P}</td><td>${b.W}</td><td>${b.S}</td><td>${b.T}</td></tr>`;
  };
  const sum = (i: number, f: (t: SetTeam) => number) => (game ? String(sets.reduce((acc, s) => acc + (s.teams[i] ? f(s.teams[i]) : 0), 0)) : '');
  const won = (i: number) => (game ? String(sets.filter((s) => s.winner === i).length) : '');
  const totalMin = game ? sets.reduce((acc, s) => acc + (minutes(s.startedAt, s.endedAt) ?? 0), 0) : null;
  const matchStart = sets[0]?.startedAt;
  const matchEnd = sets.length ? sets[sets.length - 1].endedAt : null;
  const matchMin = minutes(matchStart, matchEnd);
  const winner = game?.winner === 0 || game?.winner === 1 ? game.winner : null;
  const final = game?.status === 'finished';

  const results = `
    <table class="res">
      <tr><th colspan="4">${esc(shorts[0])} <span class="ab">A</span></th><th rowspan="2">SET<br><span class="dur">(duration, min)</span></th><th colspan="4"><span class="ab">B</span> ${esc(shorts[1])}</th></tr>
      <tr><th>"T"</th><th>S</th><th>W</th><th>P</th><th>P</th><th>W</th><th>S</th><th>"T"</th></tr>
      ${[1, 2, 3, 4, 5].map(row).join('')}
      <tr class="tot"><td>${sum(0, (t) => t.timeouts.length)}</td><td>${sum(0, (t) => t.subs.length)}</td><td>${won(0)}</td><td class="p">${sum(0, (t) => t.points)}</td>
        <td class="set">TOTAL <span class="dur">(${totalMin ?? '&nbsp;&nbsp;&nbsp;'})</span></td>
        <td class="p">${sum(1, (t) => t.points)}</td><td>${won(1)}</td><td>${sum(1, (t) => t.subs.length)}</td><td>${sum(1, (t) => t.timeouts.length)}</td></tr>
    </table>
    <table class="times">
      <tr><td>Match start<b>${esc(hhmm(matchStart))}</b></td><td>Match end<b>${esc(hhmm(matchEnd))}</b></td><td>Total duration<b>${matchMin !== null ? `${Math.floor(matchMin / 60)}h ${String(matchMin % 60).padStart(2, '0')}m` : ''}</b></td></tr>
      <tr><td colspan="3" class="win">WINNER<b>${winner !== null ? esc(shorts[winner]) : ''}</b><span class="score">${winner !== null ? `${won(winner)} : ${won(1 - winner)}` : '&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;&nbsp;'}</span></td></tr>
    </table>`;

  const finalRow = (full: string, i: number, first: boolean) => `
    <tr>
      ${first ? '<td class="fl" rowspan="2">MATCH RESULT<br><span>sets won</span></td>' : ''}
      <td class="team">${esc(full)}</td>
      <td class="score">${game ? game.teams[i]?.setsWon ?? '' : ''}</td>
    </tr>`;

  const roster = (i: number) => {
    const players = game?.teams[i]?.players ?? [];
    return Array.from({ length: Math.max(14, players.length) })
      .map((_, k) => {
        const p = players[k];
        return `<tr><td class="no">${esc(p?.jersey ?? '')}</td><td>${esc(p?.name ?? '')}</td><td class="lic">${esc(p?.licence ?? '')}</td></tr>`;
      })
      .join('');
  };
  const umpires = game?.umpires ?? [];
  const stamp = game
    ? `<span class="stamp${final ? '' : ' draft'}">${final ? 'OFFICIAL RECORD — scored in the SportAxis app' : 'MATCH IN PROGRESS — NOT FINAL'}</span>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Volleyball Scoresheet</title>
<style>
  @page { size: 13in 8.5in; margin: 6mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; font-size: 7pt; }
  table { border-collapse: collapse; }
  td, th { border: 0.8pt solid #000; padding: 0 1.5pt; font-weight: normal; text-align: center; vertical-align: middle; }
  .page { height: calc(8.5in - 12mm); display: flex; flex-direction: column; gap: 3pt; overflow: hidden; }
  .page + .page { page-break-before: always; break-before: page; }
  .top { display: flex; align-items: flex-end; justify-content: space-between; gap: 6pt; }
  h1 { font-size: 15pt; font-weight: 900; letter-spacing: 0.2pt; line-height: 1; white-space: nowrap; }
  h1 small { font-size: 8pt; font-weight: bold; color: #444; margin-left: 5pt; }
  .org { text-align: right; font-size: 7pt; color: #444; line-height: 1.3; }
  .org b { color: #111; }
  .meta { width: 100%; }
  .meta td { text-align: left; height: 13pt; font-size: 6.5pt; font-weight: bold; padding: 0 3pt; white-space: nowrap; }
  .meta td span { font-weight: normal; font-size: 7.5pt; margin-left: 3pt; }
  .ck { display: inline-block; width: 8pt; height: 8pt; border: 0.8pt solid #000; line-height: 7pt; text-align: center; font-size: 6.5pt; vertical-align: -1pt; margin: 0 2pt 0 4pt; }
  .ab { display: inline-block; width: 10pt; height: 10pt; line-height: 9pt; border: 0.8pt solid #000; border-radius: 50%; font-size: 6.5pt; font-weight: bold; text-align: center; margin-right: 2pt; }
  .sets { display: grid; grid-template-columns: 1fr 1fr; gap: 3pt; flex: 1; min-height: 0; }
  .set { display: flex; border: 1.2pt solid #000; min-height: 0; }
  .setno { width: 13pt; background: #e5e7eb; border-right: 1pt solid #000; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 6pt; font-weight: bold; }
  .setno b { font-size: 12pt; }
  .half { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .half + .half { border-left: 1.2pt solid #000; }
  .hh { display: flex; align-items: center; gap: 3pt; padding: 1.5pt 2pt; border-bottom: 0.8pt solid #000; white-space: nowrap; }
  .hh .tm { font-size: 5.5pt; font-weight: bold; }
  .hh .tm b { font-size: 7.5pt; margin-left: 2pt; display: inline-block; min-width: 24pt; border-bottom: 0.6pt solid #000; }
  .hh .team { flex: 1; font-weight: bold; font-size: 8pt; overflow: hidden; text-overflow: ellipsis; }
  .sr { display: inline-block; width: 9pt; height: 9pt; line-height: 8pt; border: 0.8pt solid #000; border-radius: 50%; font-size: 5.5pt; font-weight: bold; text-align: center; }
  .sr.on { background: #111; color: #fff; }
  .hbody { display: flex; flex: 1; min-height: 0; }
  .grid { flex: 1; width: 100%; table-layout: fixed; }
  .grid td { height: 9.5pt; font-size: 6.5pt; border-top: none; border-left: none; }
  .grid td.lbl { width: 30pt; text-align: left; font-size: 5pt; line-height: 1.05; padding: 0 1.5pt; }
  .grid tr.ord td.h { font-weight: bold; background: #e5e7eb; }
  .grid td.st { font-weight: bold; font-size: 7.5pt; }
  .grid td.sc { font-size: 5.5pt; }
  .grid tr.rd td.b { font-size: 6.5pt; }
  .grid .x { font-size: 7pt; }
  .grid .last { display: inline-block; min-width: 10pt; border: 0.8pt solid #000; border-radius: 50%; line-height: 8pt; font-weight: bold; }
  .pts { width: 56pt; display: flex; flex-direction: column; border-left: 0.8pt solid #000; }
  .pgrid { width: 100%; table-layout: fixed; }
  .pgrid th { font-size: 5pt; font-weight: bold; border-top: none; border-left: none; border-right: none; height: 8pt; }
  .pgrid td { height: 8.2pt; font-size: 5.5pt; border-color: #999; }
  .pgrid td.hit { background: linear-gradient(to top right, transparent calc(50% - 0.6pt), #000 calc(50% - 0.6pt), #000 calc(50% + 0.6pt), transparent calc(50% + 0.6pt)); font-weight: bold; }
  .pgrid td.fin { outline: 1pt solid #000; outline-offset: -1pt; }
  .tgrid { width: 100%; margin-top: auto; }
  .tgrid th { font-size: 5pt; font-weight: bold; height: 8pt; }
  .tgrid td { height: 11pt; font-size: 6.5pt; width: 50%; }
  .bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 3pt; }
  .set5 { display: flex; }
  .set5 .set { flex: 1; }
  .right { display: flex; flex-direction: column; gap: 3pt; }
  .res { width: 100%; }
  .res th { font-size: 6pt; font-weight: bold; background: #e5e7eb; height: 10pt; }
  .res td { height: 10pt; font-size: 7pt; }
  .res td.p { font-weight: bold; }
  .res td.set { font-weight: bold; white-space: nowrap; }
  .res tr.tot td { border-top: 1.4pt solid #000; font-weight: bold; }
  .dur { font-weight: normal; font-size: 6pt; }
  .times { width: 100%; }
  .times td { height: 12pt; font-size: 6pt; text-align: left; padding: 0 3pt; }
  .times td b { font-size: 8pt; margin-left: 3pt; }
  .times td.win { font-size: 8pt; font-weight: 900; }
  .times td.win b { font-size: 10pt; margin-left: 6pt; }
  .times td.win .score { float: right; font-size: 10pt; font-weight: 900; margin-right: 6pt; }
  .final { width: 100%; }
  .final td { height: 17pt; }
  .final td.fl { width: 17%; background: #e5e7eb; font-weight: 900; font-size: 7pt; line-height: 1.15; }
  .final td.fl span { font-weight: normal; font-size: 6pt; }
  .final td.team { text-align: left; padding: 0 4pt; font-size: 8.5pt; font-weight: bold; white-space: nowrap; }
  .final td.score { width: 13%; font-size: 13pt; font-weight: 900; }
  .foot { display: flex; justify-content: space-between; font-size: 6pt; color: #6b7280; }
  .stamp { display: inline-block; margin-top: 2pt; padding: 1pt 4pt; border: 1pt solid #111; font-weight: bold; font-size: 6.5pt; color: #111; }
  .stamp.draft { border-style: dashed; color: #92400e; border-color: #92400e; }
  /* Page 2 */
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 6pt; }
  .box { border: 1.2pt solid #000; }
  .box .cap { background: #e5e7eb; font-weight: bold; font-size: 8pt; padding: 2pt 4pt; border-bottom: 1pt solid #000; }
  .roster { width: 100%; }
  .roster th { font-size: 6.5pt; font-weight: bold; height: 11pt; }
  .roster td { height: 13pt; font-size: 8pt; text-align: left; padding: 0 4pt; }
  .roster td.no { width: 24pt; text-align: center; font-weight: bold; }
  .roster td.lic { width: 70pt; font-size: 7pt; color: #333; }
  .kv { width: 100%; }
  .kv td { height: 15pt; text-align: left; padding: 0 4pt; font-size: 7pt; }
  .kv td.k { width: 26%; font-weight: bold; }
  .sanctions { width: 100%; }
  .sanctions th { font-size: 6pt; font-weight: bold; height: 11pt; background: #e5e7eb; }
  .sanctions td { height: 13pt; }
  .remarks { height: 58pt; }
  @media print { .setno, .grid tr.ord td.h, .sr.on, .res th, .final td.fl, .box .cap, .sanctions th { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
<div class="page">
  <div class="top">
    <h1>VOLLEYBALL SCORESHEET<small>FIVB-style</small></h1>
    <div class="org"><b>SportAxis · Sports Office</b><br>${esc(title)}${stamp ? `<br>${stamp}` : ''}</div>
  </div>
  <table class="meta">
    <tr>
      <td style="width:30%">COMPETITION<span>${esc(title)}</span></td>
      <td style="width:20%">HALL<span>${esc(event.venueName || '')}</span></td>
      <td style="width:13%">DATE<span>${esc(fmtDate(event.schedule))}</span></td>
      <td style="width:10%">TIME<span>${esc(fmtTime(event.startTime))}</span></td>
      <td style="width:14%">DIVISION ${check(division === 'Men')}Men ${check(division === 'Women')}Women</td>
      <td>TEAMS<span><span class="ab">A</span>${esc(shorts[0])} &nbsp;vs&nbsp; <span class="ab">B</span>${esc(shorts[1])}</span></td>
    </tr>
  </table>

  <div class="sets">
    ${setBlock(1, shorts, game)}
    ${setBlock(2, shorts, game)}
    ${setBlock(3, shorts, game)}
    ${setBlock(4, shorts, game)}
  </div>

  <div class="bottom">
    <div class="set5">${setBlock(5, shorts, game)}</div>
    <div class="right">
      ${results}
      <table class="final">
        ${finalRow(teamA, 0, true)}
        ${finalRow(teamB, 1, false)}
      </table>
    </div>
  </div>

  <div class="foot"><span>${game
    ? 'From the match recorded in SportAxis — service rounds: the team’s score when that server lost the serve (circled: the set’s last point, ✕: not served) · points slashed · "T": time-outs, score at the time.'
    : 'Write the sets each team won in its box beside the team name — this strip is what the office scans.'}</span><span>SportAxis © ${new Date().getFullYear()} · page 1 of 2</span></div>
</div>

<div class="page">
  <div class="top">
    <h1>VOLLEYBALL SCORESHEET<small>teams · officials · approval</small></h1>
    <div class="org"><b>SportAxis · Sports Office</b><br>${esc(title)}</div>
  </div>
  <div class="two">
    ${[0, 1].map((i) => `
      <div class="box">
        <div class="cap"><span class="ab">${i === 0 ? 'A' : 'B'}</span>${esc(shorts[i])} — players</div>
        <table class="roster"><tr><th>N°</th><th>Name of the player</th><th>Student no.</th></tr>${roster(i)}</table>
        <table class="kv">
          <tr><td class="k">Libero players ("L")</td><td></td></tr>
          <tr><td class="k">Coach (C)</td><td>${esc(game?.teams[i]?.coach ?? '')}</td></tr>
          <tr><td class="k">Assistant coach (AC)</td><td></td></tr>
          <tr><td class="k">Team captain — signature</td><td></td></tr>
          <tr><td class="k">Coach — signature</td><td></td></tr>
        </table>
      </div>`).join('')}
  </div>
  <div class="two">
    <div class="box">
      <div class="cap">Approval</div>
      <table class="kv">
        <tr><td class="k">1st referee</td><td>${esc(umpires[0] ?? '')}</td></tr>
        <tr><td class="k">2nd referee</td><td>${esc(umpires[1] ?? '')}</td></tr>
        <tr><td class="k">Scorer</td><td>${esc(umpires[0] ?? '')}</td></tr>
        <tr><td class="k">Assistant scorer</td><td></td></tr>
        <tr><td class="k">Line judges</td><td></td></tr>
      </table>
    </div>
    <div class="box">
      <div class="cap">Sanctions</div>
      <table class="sanctions">
        <tr><th>W<br>(warning)</th><th>P<br>(penalty)</th><th>E<br>(expulsion)</th><th>D<br>(disqual.)</th><th>A / B</th><th>Set</th><th>Score</th></tr>
        ${Array.from({ length: 4 }).map(() => '<tr>' + '<td></td>'.repeat(7) + '</tr>').join('')}
      </table>
      <div class="cap" style="border-top:1pt solid #000">Remarks</div>
      <div class="remarks"></div>
    </div>
  </div>
  <div class="foot"><span>Improper requests, sanctions and remarks are written by hand — the app doesn't record them.</span><span>SportAxis © ${new Date().getFullYear()} · page 2 of 2</span></div>
</div>
</body></html>`;
}
