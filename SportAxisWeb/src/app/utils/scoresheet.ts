// ─────────────────────────────────────────────────────────────────────────────
// Printable score sheet — the sport-specific official blank sheet for an event.
// Ported from the mobile app's PrintableScoreSheetView so the web admin prints
// the exact same forms. Opens in a new tab and fires the browser print dialog
// (→ paper or "Save as PDF").
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoreSheetEvent {
  name: string;
  category: string;
  schedule?: string | null;
  startTime?: string | null;
  venueName?: string | null;
  departments?: string[] | null;
}

type SportType =
  | 'basketball' | 'volleyball' | 'badminton' | 'football'
  | 'track-field' | 'swimming' | 'tennis' | 'table-tennis'
  | 'cultural' | 'default';

// Order matters: "table tennis" is checked before "tennis" so a TT event
// doesn't fall through to the tennis sheet.
const KEYWORD_MAP: Array<[string[], SportType]> = [
  [['basketball', 'bball', '3x3'], 'basketball'],
  [['volleyball', 'vball', 'volley'], 'volleyball'],
  [['badminton', 'shuttle', 'shuttlecock'], 'badminton'],
  [['football', 'soccer', 'futsal', 'futbol'], 'football'],
  [['track', 'athletics', 'running', 'sprint', 'marathon', 'hurdle', 'relay', 'javelin', 'shot put', 'discus', 'long jump', 'high jump', 'triple jump'], 'track-field'],
  [['swimming', 'swim', 'freestyle', 'backstroke', 'breaststroke', 'butterfly', 'medley'], 'swimming'],
  [['table tennis', 'ping pong', 'pingpong'], 'table-tennis'],
  [['tennis', 'lawn tennis'], 'tennis'],
  [['cultural', 'dance', 'cheerdance', 'cheer', 'folk dance', 'modern dance', 'arts', 'performance', 'theater', 'theatre', 'chorale', 'pageant'], 'cultural'],
];

function detectSportType(category = '', name = ''): SportType {
  const haystack = `${category} ${name}`.toLowerCase().trim();
  for (const [keywords, type] of KEYWORD_MAP) {
    if (keywords.some((kw) => haystack.includes(kw))) return type;
  }
  return 'default';
}

// ── shared helpers ──────────────────────────────────────────────────────────

function fmtDate(schedule?: string | null): string {
  if (!schedule) return 'TBD';
  const d = new Date(schedule);
  return isNaN(d.getTime())
    ? String(schedule)
    : d.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: #fff; padding: 12px; }
  h1 { font-size: 15px; font-weight: 900; text-transform: uppercase; color: #991b1b; }
  h2 { font-size: 12px; font-weight: 800; text-transform: uppercase; }
  .header { text-align: center; border-bottom: 3px solid #b91c1c; padding-bottom: 8px; margin-bottom: 10px; }
  .header p { font-size: 10px; color: #374151; text-transform: uppercase; font-weight: bold; margin-top: 2px; }
  .badge { display: inline-block; padding: 2px 8px; background: #fee2e2; color: #991b1b; font-weight: bold; font-size: 10px; border-radius: 4px; border: 1px solid #fca5a5; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  th, td { border: 1.5px solid #000; padding: 5px; font-size: 10px; }
  th { background: #b91c1c; color: #fff; font-weight: bold; text-align: center; }
  .meta-table td { font-size: 10px; font-weight: bold; padding: 6px; }
  .score-table td { height: 24px; }
  .score-sheet-table th { background: #374151; }
  .score-sheet-table td.name-col { font-weight: bold; width: 45%; }
  .score-sheet-table td.max-col { text-align: center; width: 12%; background: #f9fafb; }
  .score-sheet-table td.score-col { text-align: center; width: 20%; }
  .score-sheet-table td.notes-col { width: 23%; }
  .section-title { font-size: 11px; font-weight: bold; background: #1f2937; color: #fff; padding: 4px 8px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  .sig-line { border-bottom: 1.5px solid #000; margin-top: 22px; width: 100%; }
  .sig-label { font-size: 9px; text-align: center; margin-top: 3px; }
  .sig-section { width: 100%; }
  .sig-row { display: flex; justify-content: space-between; gap: 20px; margin-top: 12px; }
  .sig-item { flex: 1; }
  .score-box { display: inline-block; width: 36px; height: 20px; border: 1.5px solid #000; text-align: center; line-height: 20px; }
  .foul-box { display: inline-block; width: 14px; height: 14px; border: 1px solid #000; text-align: center; line-height: 14px; font-size: 8px; margin: 0 1px; }
  .red-row { background: #fee2e2; }
  .blue-row { background: #dbeafe; }
  .green-row { background: #dcfce7; }
  .purple-row { background: #f3e8ff; }
  .total-row td { background: #1f2937 !important; color: #fff !important; font-weight: bold; font-size: 12px; }
  .total-row td.score { background: #b91c1c !important; font-size: 14px; text-align: center; }
  .watermark { font-size: 9px; color: #9ca3af; text-align: center; margin-top: 12px; border-top: 1px dashed #d1d5db; padding-top: 6px; }
  @media print { th, td, .section-title, .total-row td { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;

function signatureBlock(role1: string, role2: string, role3: string): string {
  return `
    <div class="sig-row">
      <div class="sig-item"><div class="sig-line"></div><div class="sig-label">${role1}</div></div>
      <div class="sig-item"><div class="sig-line"></div><div class="sig-label">${role2}</div></div>
      <div class="sig-item"><div class="sig-line"></div><div class="sig-label">${role3}</div></div>
    </div>`;
}

const watermark = () =>
  `<div class="watermark">BatStateU ARASOF Sports Office — SportAxis System © ${new Date().getFullYear()} | For Official Use Only</div>`;

const page = (inner: string) =>
  `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${BASE_CSS}</style></head><body>${inner}</body></html>`;

// ── Basketball ─────────────────────────────────────────────────────────────
function buildBasketballHtml(event: ScoreSheetEvent): string {
  const depts = event.departments || [];
  const teamA = depts[0] || 'TEAM A';
  const teamB = depts[1] || 'TEAM B';
  return page(`<style>
    .roster-table th { background: #b91c1c; }
    .roster-table td { height: 18px; }
    .running-box { border: 1.5px solid #000; padding: 6px; margin-bottom: 8px; font-size: 10px; }
  </style>
    <div class="header">
      <h1>BatStateU ARASOF – Sports Office</h1>
      <p>Official Basketball Game Score Sheet</p>
      <div class="badge">EVENT: ${event.name.toUpperCase()}</div>
    </div>

    <table class="meta-table">
      <tr>
        <td>TEAM A: <strong style="color:#b91c1c;">${teamA}</strong></td>
        <td>TEAM B: <strong style="color:#b91c1c;">${teamB}</strong></td>
        <td>VENUE: ${event.venueName || 'SPORTS COMPLEX'}</td>
        <td>DATE: ${fmtDate(event.schedule)}</td>
      </tr>
    </table>

    <div class="running-box">
      <strong>RUNNING SCORE:</strong><br/>
      1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40<br/>
      41 42 43 44 45 46 47 48 49 50 51 52 53 54 55 56 57 58 59 60 61 62 63 64 65 66 67 68 69 70 71 72 73 74 75 76 77 78 79 80<br/>
      81 82 83 84 85 86 87 88 89 90 91 92 93 94 95 96 97 98 99 100
    </div>

    <table>
      <thead><tr>
        <th style="text-align:left; width:25%;">TEAM</th>
        <th>1ST QTR</th><th>2ND QTR</th><th>3RD QTR</th><th>4TH QTR</th>
        <th>1ST OT</th><th>2ND OT</th>
        <th style="background:#7f1d1d;">FINAL SCORE</th>
      </tr></thead>
      <tbody>
        <tr class="red-row"><td style="font-weight:bold;">${teamA}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
        <tr><td style="font-weight:bold;">${teamB}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      </tbody>
    </table>

    <p class="section-title">Team A — ${teamA} — Player Roster &amp; Fouls</p>
    <table class="roster-table">
      <thead><tr>
        <th style="width:8%;">QTR</th><th style="width:30%; text-align:left;">PLAYERS</th>
        <th style="width:10%;">JERSEY #</th><th style="width:18%;">FOULS (1–5)</th>
        <th style="width:6%;">Q1</th><th style="width:6%;">Q2</th><th style="width:6%;">Q3</th><th style="width:6%;">Q4</th>
        <th style="width:5%;">OT1</th><th style="width:5%;">OT2</th><th style="width:5%;">TOTAL</th>
      </tr></thead>
      <tbody>
        ${Array.from({ length: 7 }).map(() => `<tr>
          <td style="text-align:center;font-size:8px;">1 2 3 4</td><td></td>
          <td style="text-align:center;"></td>
          <td style="text-align:center;">${[1, 2, 3, 4, 5].map((n) => `<span class="foul-box">${n}</span>`).join('')}</td>
          <td></td><td></td><td></td><td></td><td></td><td></td>
          <td style="background:#f9fafb;"></td>
        </tr>`).join('')}
      </tbody>
    </table>

    <p class="section-title">Team B — ${teamB} — Player Roster &amp; Fouls</p>
    <table class="roster-table">
      <thead><tr>
        <th style="width:8%;">QTR</th><th style="width:30%; text-align:left;">PLAYERS</th>
        <th style="width:10%;">JERSEY #</th><th style="width:18%;">FOULS (1–5)</th>
        <th style="width:6%;">Q1</th><th style="width:6%;">Q2</th><th style="width:6%;">Q3</th><th style="width:6%;">Q4</th>
        <th style="width:5%;">OT1</th><th style="width:5%;">OT2</th><th style="width:5%;">TOTAL</th>
      </tr></thead>
      <tbody>
        ${Array.from({ length: 7 }).map(() => `<tr>
          <td style="text-align:center;font-size:8px;">1 2 3 4</td><td></td>
          <td style="text-align:center;"></td>
          <td style="text-align:center;">${[1, 2, 3, 4, 5].map((n) => `<span class="foul-box">${n}</span>`).join('')}</td>
          <td></td><td></td><td></td><td></td><td></td><td></td>
          <td style="background:#f9fafb;"></td>
        </tr>`).join('')}
      </tbody>
    </table>

    ${signatureBlock("Committee's Signature &amp; Name", 'Scorekeeper / Facilitator', 'Event Coordinator')}
    ${watermark()}`);
}

// ── Volleyball ─────────────────────────────────────────────────────────────
function buildVolleyballHtml(event: ScoreSheetEvent): string {
  const depts = event.departments || [];
  const teamA = depts[0] || 'TEAM A';
  const teamB = depts[1] || 'TEAM B';
  return page(`
    <div class="header">
      <h1>BatStateU ARASOF – Sports Office</h1>
      <p>Official Volleyball Match Score Sheet</p>
      <div class="badge">EVENT: ${event.name.toUpperCase()}</div>
    </div>

    <table class="meta-table">
      <tr>
        <td>TEAM A: <strong style="color:#1d4ed8;">${teamA}</strong></td>
        <td>TEAM B: <strong style="color:#1d4ed8;">${teamB}</strong></td>
        <td>VENUE: ${event.venueName || 'SPORTS COMPLEX'}</td>
        <td>DATE: ${fmtDate(event.schedule)}</td>
      </tr>
    </table>

    <p class="section-title">Set Scores</p>
    <table>
      <thead><tr>
        <th style="text-align:left; width:25%;">TEAM</th>
        <th>SET 1</th><th>SET 2</th><th>SET 3</th><th>SET 4</th><th>SET 5</th>
        <th style="background:#1d4ed8;">SETS WON</th><th style="background:#7f1d1d;">FINAL</th>
      </tr></thead>
      <tbody>
        <tr class="blue-row"><td style="font-weight:bold;">${teamA}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
        <tr><td style="font-weight:bold;">${teamB}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      </tbody>
    </table>

    <p class="section-title">Per-Set Point Log (Running Score)</p>
    ${[1, 2, 3, 4, 5].map((n) => `
      <table>
        <thead><tr><th colspan="28">SET ${n} — Point-by-Point Log (cross each point as scored)</th></tr></thead>
        <tbody>
          <tr class="${n % 2 === 0 ? 'blue-row' : ''}">
            ${Array.from({ length: 27 }).map((_, i) => `<td style="text-align:center; width:3.5%; font-weight:bold;">${i + 1}</td>`).join('')}
            <td style="text-align:center; font-size:9px; background:#f9fafb;">TEAM</td>
          </tr>
          <tr style="height:20px;">
            ${Array.from({ length: 27 }).map(() => `<td></td>`).join('')}<td></td>
          </tr>
          <tr style="height:20px;">
            ${Array.from({ length: 27 }).map(() => `<td></td>`).join('')}<td></td>
          </tr>
        </tbody>
      </table>`).join('')}

    ${signatureBlock("Committee's Signature &amp; Name", 'Libero Tracker / Scorekeeper', 'Event Coordinator')}
    ${watermark()}`);
}

// ── Badminton ──────────────────────────────────────────────────────────────
function buildBadmintonHtml(event: ScoreSheetEvent): string {
  const depts = event.departments || [];
  const playerA = depts[0] || 'PLAYER A';
  const playerB = depts[1] || 'PLAYER B';
  return page(`
    <div class="header">
      <h1>BatStateU ARASOF – Sports Office</h1>
      <p>Official Badminton Match Score Sheet</p>
      <div class="badge">EVENT: ${event.name.toUpperCase()}</div>
    </div>

    <table class="meta-table">
      <tr>
        <td>SIDE A: <strong style="color:#047857;">${playerA}</strong></td>
        <td>SIDE B: <strong style="color:#047857;">${playerB}</strong></td>
        <td>VENUE: ${event.venueName || 'SPORTS COMPLEX'}</td>
        <td>DATE: ${fmtDate(event.schedule)}</td>
      </tr>
    </table>

    <p class="section-title">Game Scores (Best of 3 Games – 21 pts each)</p>
    <table>
      <thead><tr>
        <th style="text-align:left; width:30%;">SIDE</th>
        <th>GAME 1</th><th>GAME 2</th><th>GAME 3</th>
        <th style="background:#047857;">GAMES WON</th><th style="background:#7f1d1d;">MATCH RESULT</th>
      </tr></thead>
      <tbody>
        <tr class="green-row"><td style="font-weight:bold;">${playerA}</td><td></td><td></td><td></td><td></td><td rowspan="2" style="text-align:center; font-size:12px; font-weight:bold;"></td></tr>
        <tr><td style="font-weight:bold;">${playerB}</td><td></td><td></td><td></td><td></td></tr>
      </tbody>
    </table>

    <p class="section-title">Point-by-Point Rally Log</p>
    ${[1, 2, 3].map((g) => `
      <table>
        <thead><tr><th colspan="22" style="background:#047857;">GAME ${g} — Rally Tracker (21 pts · Cross each point as scored)</th></tr></thead>
        <tbody>
          <tr style="font-weight:bold; text-align:center;">
            ${Array.from({ length: 21 }).map((_, i) => `<td style="width:4.5%;">${i + 1}</td>`).join('')}<td style="background:#f9fafb; font-size:9px;">WINNER</td>
          </tr>
          <tr style="height:18px; background:#f0fdf4;">
            ${Array.from({ length: 21 }).map(() => `<td></td>`).join('')}<td></td>
          </tr>
          <tr style="height:18px;">
            ${Array.from({ length: 21 }).map(() => `<td></td>`).join('')}<td></td>
          </tr>
        </tbody>
      </table>`).join('')}

    ${signatureBlock("Committee's Signature &amp; Name", 'Umpire / Scorekeeper', 'Event Coordinator')}
    ${watermark()}`);
}

// ── Football ───────────────────────────────────────────────────────────────
function buildFootballHtml(event: ScoreSheetEvent): string {
  const depts = event.departments || [];
  const teamA = depts[0] || 'TEAM A';
  const teamB = depts[1] || 'TEAM B';
  return page(`
    <div class="header">
      <h1>BatStateU ARASOF – Sports Office</h1>
      <p>Official Football / Soccer Match Score Sheet</p>
      <div class="badge">EVENT: ${event.name.toUpperCase()}</div>
    </div>

    <table class="meta-table">
      <tr>
        <td>TEAM A: <strong style="color:#15803d;">${teamA}</strong></td>
        <td>TEAM B: <strong style="color:#15803d;">${teamB}</strong></td>
        <td>VENUE: ${event.venueName || 'SPORTS COMPLEX'}</td>
        <td>DATE: ${fmtDate(event.schedule)}</td>
      </tr>
    </table>

    <p class="section-title">Match Summary</p>
    <table>
      <thead><tr>
        <th style="text-align:left; width:25%;">TEAM</th>
        <th>1ST HALF</th><th>2ND HALF</th><th>EXTRA TIME 1</th><th>EXTRA TIME 2</th>
        <th style="background:#15803d;">PENALTIES</th><th style="background:#7f1d1d;">FINAL SCORE</th>
      </tr></thead>
      <tbody>
        <tr class="green-row"><td style="font-weight:bold;">${teamA}</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
        <tr><td style="font-weight:bold;">${teamB}</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      </tbody>
    </table>

    <p class="section-title">Goal Log</p>
    <table>
      <thead><tr><th style="width:8%;">#</th><th>GOAL SCORER</th><th style="width:20%;">TEAM</th><th style="width:12%;">MINUTE</th><th style="width:12%;">TYPE (Normal / Penalty / OG)</th></tr></thead>
      <tbody>
        ${Array.from({ length: 8 }).map((_, i) => `<tr><td style="text-align:center;">${i + 1}</td><td></td><td></td><td></td><td></td></tr>`).join('')}
      </tbody>
    </table>

    <p class="section-title">Cards / Misconduct</p>
    <table>
      <thead><tr><th style="width:8%;">#</th><th>PLAYER NAME</th><th style="width:20%;">TEAM</th><th style="width:12%;">MINUTE</th><th style="width:15%;">CARD (Yellow / Red)</th><th>REASON</th></tr></thead>
      <tbody>
        ${Array.from({ length: 5 }).map((_, i) => `<tr><td style="text-align:center;">${i + 1}</td><td></td><td></td><td></td><td></td><td></td></tr>`).join('')}
      </tbody>
    </table>

    ${signatureBlock("Committee's Signature &amp; Name", 'Referee / Scorekeeper', 'Event Coordinator')}
    ${watermark()}`);
}

// ── Track & Field ──────────────────────────────────────────────────────────
function buildTrackFieldHtml(event: ScoreSheetEvent): string {
  return page(`
    <div class="header">
      <h1>BatStateU ARASOF – Sports Office</h1>
      <p>Official Track &amp; Field Performance Record Sheet</p>
      <div class="badge">EVENT: ${event.name.toUpperCase()}</div>
    </div>

    <table class="meta-table">
      <tr>
        <td colspan="2">EVENT: <strong>${event.name}</strong></td>
        <td>VENUE: ${event.venueName || 'ATHLETICS TRACK'}</td>
        <td>DATE: ${fmtDate(event.schedule)}</td>
      </tr>
    </table>

    <p class="section-title">Athlete Performance Records</p>
    <table>
      <thead><tr>
        <th style="width:6%;">LANE / #</th>
        <th style="text-align:left;">ATHLETE NAME</th>
        <th style="width:18%;">DEPARTMENT</th>
        <th style="width:18%;">TIME (MM:SS.ms) / DISTANCE (m)</th>
        <th style="width:10%;">RANK</th>
        <th style="width:12%;">REMARKS</th>
      </tr></thead>
      <tbody>
        ${(event.departments || ['–']).map((dept) => `
          <tr>
            <td style="text-align:center;"></td>
            <td></td>
            <td style="font-weight:bold; color:#7c3aed;">${dept}</td>
            <td style="text-align:center;"></td>
            <td style="text-align:center;"></td>
            <td></td>
          </tr>
          <tr style="height:20px;"><td></td><td></td><td style="color:#9ca3af; font-size:9px;">${dept}</td><td></td><td></td><td></td></tr>
          <tr style="height:20px;"><td></td><td></td><td style="color:#9ca3af; font-size:9px;">${dept}</td><td></td><td></td><td></td></tr>
        `).join('')}
      </tbody>
    </table>

    <p class="section-title">Best Times / Distances Summary</p>
    <table>
      <thead><tr><th>RANK</th><th>ATHLETE</th><th>DEPARTMENT</th><th>RESULT</th><th>STANDARD MET</th></tr></thead>
      <tbody>
        ${Array.from({ length: 5 }).map((_, i) => `<tr><td style="text-align:center; font-weight:bold;">${i + 1}</td><td></td><td></td><td></td><td></td></tr>`).join('')}
      </tbody>
    </table>

    ${signatureBlock("Committee's Signature &amp; Name", 'Official Timer / Measurer', 'Event Coordinator')}
    ${watermark()}`);
}

// ── Swimming ───────────────────────────────────────────────────────────────
function buildSwimmingHtml(event: ScoreSheetEvent): string {
  const depts = event.departments || [];
  return page(`
    <div class="header">
      <h1>BatStateU ARASOF – Sports Office</h1>
      <p>Official Swimming Race Score Sheet</p>
      <div class="badge">EVENT: ${event.name.toUpperCase()}</div>
    </div>

    <table class="meta-table">
      <tr>
        <td colspan="2">EVENT: <strong>${event.name}</strong></td>
        <td>POOL: ${event.venueName || 'AQUATICS CENTER'}</td>
        <td>DATE: ${fmtDate(event.schedule)}</td>
      </tr>
    </table>

    <p class="section-title">Lane &amp; Time Record</p>
    <table>
      <thead><tr>
        <th style="width:8%;">LANE</th>
        <th style="text-align:left;">SWIMMER NAME</th>
        <th style="width:18%;">DEPARTMENT</th>
        <th style="width:14%;">STROKE STYLE</th>
        <th style="width:12%;">LAP 1</th>
        <th style="width:12%;">LAP 2</th>
        <th style="width:12%;">FINISH TIME</th>
        <th style="width:8%;">PLACE</th>
      </tr></thead>
      <tbody>
        ${depts.map((dept, i) => `
          <tr class="${i % 2 === 0 ? '' : 'blue-row'}">
            <td style="text-align:center;">${i + 1}</td>
            <td></td>
            <td style="font-weight:bold; color:#0284c7;">${dept}</td>
            <td style="text-align:center;">□ Free  □ Back<br/>□ Breast  □ Fly</td>
            <td style="text-align:center;"></td>
            <td style="text-align:center;"></td>
            <td style="text-align:center; font-weight:bold;"></td>
            <td style="text-align:center;"></td>
          </tr>
        `).join('')}
        ${Array.from({ length: Math.max(0, 4 - depts.length) }).map((_, i) => `
          <tr>
            <td style="text-align:center;">${depts.length + i + 1}</td>
            <td></td><td></td>
            <td style="text-align:center;">□ Free  □ Back<br/>□ Breast  □ Fly</td>
            <td></td><td></td><td></td><td></td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    ${signatureBlock("Committee's Signature &amp; Name", 'Official Timer / Stroke Committee', 'Event Coordinator')}
    ${watermark()}`);
}

// ── Tennis ─────────────────────────────────────────────────────────────────
function buildTennisHtml(event: ScoreSheetEvent): string {
  const depts = event.departments || [];
  const playerA = depts[0] || 'PLAYER A';
  const playerB = depts[1] || 'PLAYER B';
  return page(`
    <div class="header">
      <h1>BatStateU ARASOF – Sports Office</h1>
      <p>Official Tennis Match Score Sheet</p>
      <div class="badge">EVENT: ${event.name.toUpperCase()}</div>
    </div>

    <table class="meta-table">
      <tr>
        <td>PLAYER A: <strong style="color:#b45309;">${playerA}</strong></td>
        <td>PLAYER B: <strong style="color:#b45309;">${playerB}</strong></td>
        <td>COURT: ${event.venueName || 'TENNIS COURT'}</td>
        <td>DATE: ${fmtDate(event.schedule)}</td>
      </tr>
    </table>

    <p class="section-title">Set &amp; Game Scores</p>
    <table>
      <thead><tr>
        <th style="text-align:left; width:25%;">PLAYER</th>
        <th>SET 1</th><th>SET 2</th><th>SET 3</th>
        <th style="background:#b45309;">SETS WON</th><th style="background:#7f1d1d;">MATCH RESULT</th>
      </tr></thead>
      <tbody>
        <tr style="background:#fef3c7;"><td style="font-weight:bold;">${playerA}</td><td></td><td></td><td></td><td></td><td rowspan="2" style="text-align:center; font-size:12px; font-weight:bold;"></td></tr>
        <tr><td style="font-weight:bold;">${playerB}</td><td></td><td></td><td></td><td></td></tr>
      </tbody>
    </table>

    <p class="section-title">Game-by-Game Breakdown</p>
    ${[1, 2, 3].map((s) => `
      <table>
        <thead><tr><th colspan="8" style="background:#b45309;">SET ${s} — Game Scores (circle winner of each game)</th></tr>
        <tr><th style="text-align:left; width:25%;">PLAYER</th>
          ${Array.from({ length: 7 }).map((_, i) => `<th style="width:10%;">G${i + 1}</th>`).join('')}
        </tr></thead>
        <tbody>
          <tr style="background:#fef3c7;"><td style="font-weight:bold;">${playerA}</td>${Array.from({ length: 7 }).map(() => '<td></td>').join('')}</tr>
          <tr><td style="font-weight:bold;">${playerB}</td>${Array.from({ length: 7 }).map(() => '<td></td>').join('')}</tr>
        </tbody>
      </table>`).join('')}

    ${signatureBlock("Committee's Signature &amp; Name", 'Chair Umpire / Scorekeeper', 'Event Coordinator')}
    ${watermark()}`);
}

// ── Table Tennis ───────────────────────────────────────────────────────────
function buildTableTennisHtml(event: ScoreSheetEvent): string {
  const depts = event.departments || [];
  const playerA = depts[0] || 'PLAYER A';
  const playerB = depts[1] || 'PLAYER B';
  return page(`
    <div class="header">
      <h1>BatStateU ARASOF – Sports Office</h1>
      <p>Official Table Tennis Match Score Sheet</p>
      <div class="badge">EVENT: ${event.name.toUpperCase()}</div>
    </div>

    <table class="meta-table">
      <tr>
        <td>SIDE A: <strong style="color:#0f766e;">${playerA}</strong></td>
        <td>SIDE B: <strong style="color:#0f766e;">${playerB}</strong></td>
        <td>VENUE: ${event.venueName || 'TABLE TENNIS HALL'}</td>
        <td>DATE: ${fmtDate(event.schedule)}</td>
      </tr>
    </table>

    <p class="section-title">Game Scores (Best of 5 – 11 pts each)</p>
    <table>
      <thead><tr>
        <th style="text-align:left; width:25%;">SIDE</th>
        <th>GAME 1</th><th>GAME 2</th><th>GAME 3</th><th>GAME 4</th><th>GAME 5</th>
        <th style="background:#0f766e;">GAMES WON</th><th style="background:#7f1d1d;">MATCH</th>
      </tr></thead>
      <tbody>
        <tr style="background:#ccfbf1;"><td style="font-weight:bold;">${playerA}</td><td></td><td></td><td></td><td></td><td></td><td></td><td rowspan="2" style="text-align:center;font-size:12px;font-weight:bold;"></td></tr>
        <tr><td style="font-weight:bold;">${playerB}</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      </tbody>
    </table>

    <p class="section-title">Point Log per Game (11 pts = 1 game)</p>
    ${[1, 2, 3, 4, 5].map((g) => `
      <table>
        <thead><tr><th colspan="13" style="background:#0f766e;">GAME ${g} — Points (circle point as scored)</th></tr>
        <tr><th style="text-align:left;width:18%;">SIDE</th>${Array.from({ length: 12 }).map((_, i) => `<th style="width:6.7%;">${i + 1}</th>`).join('')}</tr></thead>
        <tbody>
          <tr style="background:#ccfbf1;"><td style="font-weight:bold;">${playerA}</td>${Array.from({ length: 12 }).map(() => '<td></td>').join('')}</tr>
          <tr><td style="font-weight:bold;">${playerB}</td>${Array.from({ length: 12 }).map(() => '<td></td>').join('')}</tr>
        </tbody>
      </table>`).join('')}

    ${signatureBlock("Committee's Signature &amp; Name", 'Umpire / Scorekeeper', 'Event Coordinator')}
    ${watermark()}`);
}

// ── Cultural / Arts ────────────────────────────────────────────────────────
function buildCulturalHtml(event: ScoreSheetEvent): string {
  const depts = event.departments || [];
  return page(`<style>
    .perf-header { background: #7c3aed; color: #fff; padding: 6px 10px; font-weight: bold; font-size: 11px; border-radius: 4px; margin-bottom: 6px; }
  </style>
    <div class="header">
      <h1>BatStateU ARASOF – Sports Office</h1>
      <p>Official Cultural / Performing Arts Evaluation Sheet</p>
      <div class="badge" style="background:#f3e8ff; color:#7c3aed; border-color:#ddd6fe;">EVENT: ${event.name.toUpperCase()}</div>
    </div>

    <table class="meta-table">
      <tr>
        <td colspan="2">EVENT: <strong>${event.name}</strong></td>
        <td>VENUE: ${event.venueName || 'MAIN STAGE'}</td>
        <td>DATE: ${fmtDate(event.schedule)}</td>
      </tr>
    </table>

    <p class="section-title">Participating Teams</p>
    <table>
      <thead><tr><th style="width:8%;">#</th><th>TEAM / DEPARTMENT</th><th style="width:20%;">PERFORMANCE TITLE</th><th style="width:15%;">DURATION</th><th style="width:10%;">ORDER</th></tr></thead>
      <tbody>
        ${depts.map((dept, i) => `<tr><td style="text-align:center;">${i + 1}</td><td style="font-weight:bold; color:#7c3aed;">${dept}</td><td></td><td></td><td style="text-align:center;"></td></tr>`).join('')}
        ${Array.from({ length: Math.max(0, 3 - depts.length) }).map((_, i) => `<tr><td style="text-align:center;">${depts.length + i + 1}</td><td></td><td></td><td></td><td></td></tr>`).join('')}
      </tbody>
    </table>

    <p class="section-title">Overall Score Sheet (Max 100 per team)</p>
    <table>
      <thead>
        <tr>
          <th style="text-align:left;">TEAM / DEPARTMENT</th>
          <th style="width:20%;">OVERALL SCORE (0–100)</th>
          <th style="width:15%;">RANK</th>
          <th style="width:30%;">NOTES</th>
        </tr>
      </thead>
      <tbody>
        ${(depts.length ? depts : ['', '', '']).map((dept) => `
          <tr style="height:34px;">
            <td style="font-weight:bold; color:#7c3aed;">${dept}</td>
            <td style="text-align:center;"></td>
            <td style="text-align:center; font-size:16px; font-weight:bold;"></td>
            <td></td>
          </tr>`).join('')}
      </tbody>
    </table>

    <p class="section-title">Committee's Remarks &amp; Comments</p>
    <table>
      <thead><tr><th style="text-align:left; width:25%;">TEAM</th><th>OVERALL REMARKS</th><th style="width:18%;">STRENGTHS</th><th style="width:18%;">AREAS FOR IMPROVEMENT</th></tr></thead>
      <tbody>
        ${depts.map((dept) => `<tr style="height:36px;"><td style="font-weight:bold; color:#7c3aed;">${dept}</td><td></td><td></td><td></td></tr>`).join('')}
      </tbody>
    </table>

    ${signatureBlock("Committee's Signature &amp; Name", 'Panel Coordinator', 'Event Coordinator')}
    ${watermark()}`);
}

// ── Default / Generic ──────────────────────────────────────────────────────
function buildDefaultHtml(event: ScoreSheetEvent): string {
  const depts = event.departments || [];
  return page(`
    <div class="header">
      <h1>BatStateU ARASOF – Sports Office</h1>
      <p>Official Event Score Sheet</p>
      <div class="badge">EVENT: ${event.name.toUpperCase()}</div>
    </div>

    <table class="meta-table">
      <tr>
        <td>CATEGORY: <strong>${event.category}</strong></td>
        <td colspan="2">EVENT: <strong>${event.name}</strong></td>
        <td>DATE: ${fmtDate(event.schedule)}</td>
      </tr>
      <tr>
        <td>VENUE: ${event.venueName || 'TBD'}</td>
        <td colspan="3">DEPARTMENTS: ${depts.join(' · ') || 'TBD'}</td>
      </tr>
    </table>

    <p class="section-title">Overall Score Sheet (Max 100 per team)</p>
    <table class="score-sheet-table">
      <thead><tr>
        <th class="name-col">TEAM / DEPARTMENT</th>
        <th class="score-col">OVERALL SCORE (0–100)</th>
        <th style="width:12%;">RANK</th>
        <th class="notes-col">NOTES</th>
      </tr></thead>
      <tbody>
        ${(depts.length ? depts : ['']).map((dept) => `
          <tr style="height:30px;">
            <td class="name-col">${dept}</td>
            <td class="score-col"></td>
            <td style="text-align:center; font-weight:bold;"></td>
            <td class="notes-col"></td>
          </tr>`).join('')}
      </tbody>
    </table>

    ${signatureBlock("Committee's Signature &amp; Name", 'Scoring Facilitator', 'Event Coordinator')}
    ${watermark()}`);
}

export function buildScoreSheetHtml(event: ScoreSheetEvent): string {
  switch (detectSportType(event.category, event.name)) {
    case 'basketball':   return buildBasketballHtml(event);
    case 'volleyball':   return buildVolleyballHtml(event);
    case 'badminton':    return buildBadmintonHtml(event);
    case 'football':     return buildFootballHtml(event);
    case 'track-field':  return buildTrackFieldHtml(event);
    case 'swimming':     return buildSwimmingHtml(event);
    case 'tennis':       return buildTennisHtml(event);
    case 'table-tennis': return buildTableTennisHtml(event);
    case 'cultural':     return buildCulturalHtml(event);
    default:             return buildDefaultHtml(event);
  }
}

/** Open the sport's score sheet in a new tab and fire the print dialog. */
export function printScoreSheet(event: ScoreSheetEvent): boolean {
  const html = buildScoreSheetHtml(event);
  const w = window.open('', '_blank');
  if (!w) return false; // pop-up blocked
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    try { w.print(); } catch { /* user can print manually */ }
  }, 300);
  return true;
}
