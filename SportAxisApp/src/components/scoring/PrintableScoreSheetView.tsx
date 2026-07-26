import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React from 'react';
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { COLORS, FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOWS, SPACING } from '../../../constants/theme';
import type { Criterion, EventSession } from '../../types';
import { getSportConfigFromEvent } from '../../utils/sport-config';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

// ─────────────────────────────────────────────────────────────────────────────
// PrintableScoreSheetView — Generates sport-specific printable HTML score sheets
// ─────────────────────────────────────────────────────────────────────────────

interface PrintableScoreSheetViewProps {
  event: EventSession;
  criteria: Criterion[];
  onClose?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared CSS injected into every HTML template
// ─────────────────────────────────────────────────────────────────────────────
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
  .criteria-table th { background: #374151; }
  .criteria-table td.name-col { font-weight: bold; width: 45%; }
  .criteria-table td.max-col { text-align: center; width: 12%; background: #f9fafb; }
  .criteria-table td.score-col { text-align: center; width: 20%; }
  .criteria-table td.notes-col { width: 23%; }
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
`;

// ─────────────────────────────────────────────────────────────────────────────
// HTML Template Generators per sport
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(schedule: string | undefined) {
  if (!schedule) return 'TBD';
  return new Date(schedule).toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function criteriaRows(criteria: Criterion[]) {
  if (!criteria.length) return '<tr><td colspan="4" style="text-align:center;color:#9ca3af;">No criteria defined.</td></tr>';
  return criteria.map(c => `
    <tr>
      <td class="name-col">${c.name}${c.weight ? ` <span style="color:#9ca3af;">(${c.weight}%)</span>` : ''}</td>
      <td class="max-col">${c.max_score}</td>
      <td class="score-col"></td>
      <td class="notes-col"></td>
    </tr>`).join('');
}

function signatureBlock(role1: string, role2: string, role3: string) {
  return `
    <div class="sig-row">
      <div class="sig-item"><div class="sig-line"></div><div class="sig-label">${role1}</div></div>
      <div class="sig-item"><div class="sig-line"></div><div class="sig-label">${role2}</div></div>
      <div class="sig-item"><div class="sig-line"></div><div class="sig-label">${role3}</div></div>
    </div>`;
}

// ── Basketball ────────────────────────────────────────────────────────────────
function buildBasketballHtml(event: EventSession, criteria: Criterion[]): string {
  const depts = event.departments || [];
  const teamA = depts[0] || 'TEAM A';
  const teamB = depts[1] || 'TEAM B';
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${BASE_CSS}
    .roster-table th { background: #b91c1c; }
    .roster-table td { height: 18px; }
    .running-box { border: 1.5px solid #000; padding: 6px; margin-bottom: 8px; font-size: 10px; }
  </style></head><body>
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

    <p class="section-title">🏀 Team A — ${teamA} — Player Roster &amp; Fouls</p>
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
          <td style="text-align:center;">${[1,2,3,4,5].map(n => `<span class="foul-box">${n}</span>`).join('')}</td>
          <td></td><td></td><td></td><td></td><td></td><td></td>
          <td style="background:#f9fafb;"></td>
        </tr>`).join('')}
      </tbody>
    </table>

    <p class="section-title">🏀 Team B — ${teamB} — Player Roster &amp; Fouls</p>
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
          <td style="text-align:center;">${[1,2,3,4,5].map(n => `<span class="foul-box">${n}</span>`).join('')}</td>
          <td></td><td></td><td></td><td></td><td></td><td></td>
          <td style="background:#f9fafb;"></td>
        </tr>`).join('')}
      </tbody>
    </table>

    ${criteria.length > 0 ? `
    <p class="section-title">📋 Judge's Criteria Evaluation</p>
    <table class="criteria-table">
      <thead><tr><th class="name-col">CRITERION</th><th class="max-col">MAX</th><th class="score-col">SCORE</th><th class="notes-col">NOTES / REMARKS</th></tr></thead>
      <tbody>
        ${criteriaRows(criteria)}
        <tr class="total-row"><td colspan="2">TOTAL SCORE</td><td class="score"></td><td></td></tr>
      </tbody>
    </table>` : ''}

    ${signatureBlock('Judge\'s Signature &amp; Name', 'Scorekeeper / Facilitator', 'Event Coordinator')}
    <div class="watermark">BatStateU ARASOF Sports Office — SportAxis System © ${new Date().getFullYear()} | For Official Use Only</div>
  </body></html>`;
}

// ── Volleyball ────────────────────────────────────────────────────────────────
function buildVolleyballHtml(event: EventSession, criteria: Criterion[]): string {
  const depts = event.departments || [];
  const teamA = depts[0] || 'TEAM A';
  const teamB = depts[1] || 'TEAM B';
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${BASE_CSS}</style></head><body>
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

    <p class="section-title">🏐 Set Scores</p>
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

    <p class="section-title">📋 Per-Set Point Log (Running Score)</p>
    ${[1, 2, 3, 4, 5].map(n => `
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

    ${criteria.length > 0 ? `
    <p class="section-title">📋 Judge's Criteria Evaluation</p>
    <table class="criteria-table">
      <thead><tr><th class="name-col">CRITERION</th><th class="max-col">MAX</th><th class="score-col">SCORE</th><th class="notes-col">NOTES / REMARKS</th></tr></thead>
      <tbody>
        ${criteriaRows(criteria)}
        <tr class="total-row"><td colspan="2">TOTAL SCORE</td><td class="score"></td><td></td></tr>
      </tbody>
    </table>` : ''}

    ${signatureBlock('Judge\'s Signature &amp; Name', 'Libero Tracker / Scorekeeper', 'Event Coordinator')}
    <div class="watermark">BatStateU ARASOF Sports Office — SportAxis System © ${new Date().getFullYear()} | For Official Use Only</div>
  </body></html>`;
}

// ── Badminton ─────────────────────────────────────────────────────────────────
function buildBadmintonHtml(event: EventSession, criteria: Criterion[]): string {
  const depts = event.departments || [];
  const playerA = depts[0] || 'PLAYER A';
  const playerB = depts[1] || 'PLAYER B';
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${BASE_CSS}</style></head><body>
    <div class="header">
      <h1>BatStateU ARASOF – Sports Office</h1>
      <p>Official Badminton Match Score Sheet</p>
      <div class="badge">EVENT: ${event.name.toUpperCase()}</div>
    </div>

    <table class="meta-table">
      <tr>
        <td>PLAYER A: <strong style="color:#047857;">${playerA}</strong></td>
        <td>PLAYER B: <strong style="color:#047857;">${playerB}</strong></td>
        <td>VENUE: ${event.venueName || 'SPORTS COMPLEX'}</td>
        <td>DATE: ${fmtDate(event.schedule)}</td>
      </tr>
    </table>

    <p class="section-title">🏸 Game Scores (Best of 3 Games – 21 pts each)</p>
    <table>
      <thead><tr>
        <th style="text-align:left; width:30%;">PLAYER</th>
        <th>GAME 1</th><th>GAME 2</th><th>GAME 3</th>
        <th style="background:#047857;">GAMES WON</th><th style="background:#7f1d1d;">MATCH RESULT</th>
      </tr></thead>
      <tbody>
        <tr class="green-row"><td style="font-weight:bold;">${playerA}</td><td></td><td></td><td></td><td></td><td rowspan="2" style="text-align:center; font-size:12px; font-weight:bold;"></td></tr>
        <tr><td style="font-weight:bold;">${playerB}</td><td></td><td></td><td></td><td></td></tr>
      </tbody>
    </table>

    <p class="section-title">📋 Point-by-Point Rally Log</p>
    ${[1, 2, 3].map(g => `
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

    ${criteria.length > 0 ? `
    <p class="section-title">📋 Judge's Criteria Evaluation</p>
    <table class="criteria-table">
      <thead><tr><th class="name-col">CRITERION</th><th class="max-col">MAX</th><th class="score-col">SCORE</th><th class="notes-col">NOTES / REMARKS</th></tr></thead>
      <tbody>
        ${criteriaRows(criteria)}
        <tr class="total-row"><td colspan="2">TOTAL SCORE</td><td class="score"></td><td></td></tr>
      </tbody>
    </table>` : ''}

    ${signatureBlock('Judge\'s Signature &amp; Name', 'Umpire / Scorekeeper', 'Event Coordinator')}
    <div class="watermark">BatStateU ARASOF Sports Office — SportAxis System © ${new Date().getFullYear()} | For Official Use Only</div>
  </body></html>`;
}

// ── Football ──────────────────────────────────────────────────────────────────
function buildFootballHtml(event: EventSession, criteria: Criterion[]): string {
  const depts = event.departments || [];
  const teamA = depts[0] || 'TEAM A';
  const teamB = depts[1] || 'TEAM B';
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${BASE_CSS}</style></head><body>
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

    <p class="section-title">⚽ Match Summary</p>
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

    <p class="section-title">🥅 Goal Log</p>
    <table>
      <thead><tr><th style="width:8%;">#</th><th>GOAL SCORER</th><th style="width:20%;">TEAM</th><th style="width:12%;">MINUTE</th><th style="width:12%;">TYPE (Normal / Penalty / OG)</th></tr></thead>
      <tbody>
        ${Array.from({ length: 8 }).map((_, i) => `<tr><td style="text-align:center;">${i + 1}</td><td></td><td></td><td></td><td></td></tr>`).join('')}
      </tbody>
    </table>

    <p class="section-title">🟨🟥 Cards / Misconduct</p>
    <table>
      <thead><tr><th style="width:8%;">#</th><th>PLAYER NAME</th><th style="width:20%;">TEAM</th><th style="width:12%;">MINUTE</th><th style="width:15%;">CARD (Yellow / Red)</th><th>REASON</th></tr></thead>
      <tbody>
        ${Array.from({ length: 5 }).map((_, i) => `<tr><td style="text-align:center;">${i + 1}</td><td></td><td></td><td></td><td></td><td></td></tr>`).join('')}
      </tbody>
    </table>

    ${criteria.length > 0 ? `
    <p class="section-title">📋 Judge's Criteria Evaluation</p>
    <table class="criteria-table">
      <thead><tr><th class="name-col">CRITERION</th><th class="max-col">MAX</th><th class="score-col">SCORE</th><th class="notes-col">NOTES / REMARKS</th></tr></thead>
      <tbody>
        ${criteriaRows(criteria)}
        <tr class="total-row"><td colspan="2">TOTAL SCORE</td><td class="score"></td><td></td></tr>
      </tbody>
    </table>` : ''}

    ${signatureBlock('Judge\'s Signature &amp; Name', 'Referee / Scorekeeper', 'Event Coordinator')}
    <div class="watermark">BatStateU ARASOF Sports Office — SportAxis System © ${new Date().getFullYear()} | For Official Use Only</div>
  </body></html>`;
}

// ── Track & Field ─────────────────────────────────────────────────────────────
function buildTrackFieldHtml(event: EventSession, criteria: Criterion[]): string {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${BASE_CSS}</style></head><body>
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

    <p class="section-title">🏃 Athlete Performance Records</p>
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
        ${(event.departments || ['–']).map(dept => `
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

    <p class="section-title">⏱ Best Times / Distances Summary</p>
    <table>
      <thead><tr><th>RANK</th><th>ATHLETE</th><th>DEPARTMENT</th><th>RESULT</th><th>STANDARD MET</th></tr></thead>
      <tbody>
        ${Array.from({ length: 5 }).map((_, i) => `<tr><td style="text-align:center; font-weight:bold;">${i + 1}</td><td></td><td></td><td></td><td></td></tr>`).join('')}
      </tbody>
    </table>

    ${criteria.length > 0 ? `
    <p class="section-title">📋 Technique Evaluation</p>
    <table class="criteria-table">
      <thead><tr><th class="name-col">CRITERION</th><th class="max-col">MAX</th><th class="score-col">SCORE</th><th class="notes-col">NOTES</th></tr></thead>
      <tbody>
        ${criteriaRows(criteria)}
        <tr class="total-row"><td colspan="2">TOTAL SCORE</td><td class="score"></td><td></td></tr>
      </tbody>
    </table>` : ''}

    ${signatureBlock('Judge\'s Signature &amp; Name', 'Official Timer / Measurer', 'Event Coordinator')}
    <div class="watermark">BatStateU ARASOF Sports Office — SportAxis System © ${new Date().getFullYear()} | For Official Use Only</div>
  </body></html>`;
}

// ── Swimming ──────────────────────────────────────────────────────────────────
function buildSwimmingHtml(event: EventSession, criteria: Criterion[]): string {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${BASE_CSS}</style></head><body>
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

    <p class="section-title">🏊 Lane & Time Record</p>
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
        ${(event.departments || []).map((dept, i) => `
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
        ${Array.from({ length: Math.max(0, 4 - (event.departments || []).length) }).map((_, i) => `
          <tr>
            <td style="text-align:center;">${(event.departments || []).length + i + 1}</td>
            <td></td><td></td>
            <td style="text-align:center;">□ Free  □ Back<br/>□ Breast  □ Fly</td>
            <td></td><td></td><td></td><td></td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    ${criteria.length > 0 ? `
    <p class="section-title">📋 Technical Evaluation</p>
    <table class="criteria-table">
      <thead><tr><th class="name-col">CRITERION</th><th class="max-col">MAX</th><th class="score-col">SCORE</th><th class="notes-col">NOTES</th></tr></thead>
      <tbody>
        ${criteriaRows(criteria)}
        <tr class="total-row"><td colspan="2">TOTAL SCORE</td><td class="score"></td><td></td></tr>
      </tbody>
    </table>` : ''}

    ${signatureBlock('Judge\'s Signature &amp; Name', 'Official Timer / Stroke Judge', 'Event Coordinator')}
    <div class="watermark">BatStateU ARASOF Sports Office — SportAxis System © ${new Date().getFullYear()} | For Official Use Only</div>
  </body></html>`;
}

// ── Tennis ────────────────────────────────────────────────────────────────────
function buildTennisHtml(event: EventSession, criteria: Criterion[]): string {
  const depts = event.departments || [];
  const playerA = depts[0] || 'PLAYER A';
  const playerB = depts[1] || 'PLAYER B';
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${BASE_CSS}</style></head><body>
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

    <p class="section-title">🎾 Set & Game Scores</p>
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

    <p class="section-title">📊 Game-by-Game Breakdown</p>
    ${[1, 2, 3].map(s => `
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

    ${criteria.length > 0 ? `
    <p class="section-title">📋 Judge's Criteria Evaluation</p>
    <table class="criteria-table">
      <thead><tr><th class="name-col">CRITERION</th><th class="max-col">MAX</th><th class="score-col">SCORE</th><th class="notes-col">NOTES</th></tr></thead>
      <tbody>
        ${criteriaRows(criteria)}
        <tr class="total-row"><td colspan="2">TOTAL SCORE</td><td class="score"></td><td></td></tr>
      </tbody>
    </table>` : ''}

    ${signatureBlock('Judge\'s Signature &amp; Name', 'Chair Umpire / Scorekeeper', 'Event Coordinator')}
    <div class="watermark">BatStateU ARASOF Sports Office — SportAxis System © ${new Date().getFullYear()} | For Official Use Only</div>
  </body></html>`;
}

// ── Table Tennis ──────────────────────────────────────────────────────────────
function buildTableTennisHtml(event: EventSession, criteria: Criterion[]): string {
  const depts = event.departments || [];
  const playerA = depts[0] || 'PLAYER A';
  const playerB = depts[1] || 'PLAYER B';
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${BASE_CSS}</style></head><body>
    <div class="header">
      <h1>BatStateU ARASOF – Sports Office</h1>
      <p>Official Table Tennis Match Score Sheet</p>
      <div class="badge">EVENT: ${event.name.toUpperCase()}</div>
    </div>

    <table class="meta-table">
      <tr>
        <td>PLAYER A: <strong style="color:#0f766e;">${playerA}</strong></td>
        <td>PLAYER B: <strong style="color:#0f766e;">${playerB}</strong></td>
        <td>VENUE: ${event.venueName || 'TABLE TENNIS HALL'}</td>
        <td>DATE: ${fmtDate(event.schedule)}</td>
      </tr>
    </table>

    <p class="section-title">🏓 Game Scores (Best of 5 – 11 pts each)</p>
    <table>
      <thead><tr>
        <th style="text-align:left; width:25%;">PLAYER</th>
        <th>GAME 1</th><th>GAME 2</th><th>GAME 3</th><th>GAME 4</th><th>GAME 5</th>
        <th style="background:#0f766e;">GAMES WON</th><th style="background:#7f1d1d;">MATCH</th>
      </tr></thead>
      <tbody>
        <tr style="background:#ccfbf1;"><td style="font-weight:bold;">${playerA}</td><td></td><td></td><td></td><td></td><td></td><td></td><td rowspan="2" style="text-align:center;font-size:12px;font-weight:bold;"></td></tr>
        <tr><td style="font-weight:bold;">${playerB}</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      </tbody>
    </table>

    <p class="section-title">📋 Point Log per Game (11 pts = 1 game)</p>
    ${[1, 2, 3, 4, 5].map(g => `
      <table>
        <thead><tr><th colspan="13" style="background:#0f766e;">GAME ${g} — Points (circle point as scored)</th></tr>
        <tr><th style="text-align:left;width:18%;">PLAYER</th>${Array.from({ length: 12 }).map((_, i) => `<th style="width:6.7%;">${i + 1}</th>`).join('')}</tr></thead>
        <tbody>
          <tr style="background:#ccfbf1;"><td style="font-weight:bold;">${playerA}</td>${Array.from({ length: 12 }).map(() => '<td></td>').join('')}</tr>
          <tr><td style="font-weight:bold;">${playerB}</td>${Array.from({ length: 12 }).map(() => '<td></td>').join('')}</tr>
        </tbody>
      </table>`).join('')}

    ${criteria.length > 0 ? `
    <p class="section-title">📋 Judge's Criteria Evaluation</p>
    <table class="criteria-table">
      <thead><tr><th class="name-col">CRITERION</th><th class="max-col">MAX</th><th class="score-col">SCORE</th><th class="notes-col">NOTES</th></tr></thead>
      <tbody>
        ${criteriaRows(criteria)}
        <tr class="total-row"><td colspan="2">TOTAL SCORE</td><td class="score"></td><td></td></tr>
      </tbody>
    </table>` : ''}

    ${signatureBlock('Judge\'s Signature &amp; Name', 'Umpire / Scorekeeper', 'Event Coordinator')}
    <div class="watermark">BatStateU ARASOF Sports Office — SportAxis System © ${new Date().getFullYear()} | For Official Use Only</div>
  </body></html>`;
}

// ── Cultural / Arts ───────────────────────────────────────────────────────────
function buildCulturalHtml(event: EventSession, criteria: Criterion[]): string {
  const maxTotal = criteria.reduce((s, c) => s + c.max_score, 0);
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${BASE_CSS}
    .perf-header { background: #7c3aed; color: #fff; padding: 6px 10px; font-weight: bold; font-size: 11px; border-radius: 4px; margin-bottom: 6px; }
  </style></head><body>
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

    <p class="section-title">🎭 Participating Teams</p>
    <table>
      <thead><tr><th style="width:8%;">#</th><th>TEAM / DEPARTMENT</th><th style="width:20%;">PERFORMANCE TITLE</th><th style="width:15%;">DURATION</th><th style="width:10%;">ORDER</th></tr></thead>
      <tbody>
        ${(event.departments || []).map((dept, i) => `<tr><td style="text-align:center;">${i + 1}</td><td style="font-weight:bold; color:#7c3aed;">${dept}</td><td></td><td></td><td style="text-align:center;"></td></tr>`).join('')}
        ${Array.from({ length: Math.max(0, 3 - (event.departments || []).length) }).map((_, i) => `<tr><td style="text-align:center;">${(event.departments || []).length + i + 1}</td><td></td><td></td><td></td><td></td></tr>`).join('')}
      </tbody>
    </table>

    <p class="section-title">📋 Criteria Scoring Sheet (Max Total: ${maxTotal})</p>
    <table>
      <thead>
        <tr>
          <th style="text-align:left; width:35%;">CRITERION</th>
          <th style="width:10%;">MAX SCORE</th>
          ${(event.departments || ['TEAM A', 'TEAM B', 'TEAM C']).slice(0, 4).map(d => `<th style="width:12%;">${d}</th>`).join('')}
          <th style="width:10%;">NOTES</th>
        </tr>
      </thead>
      <tbody>
        ${criteria.map(c => `
          <tr>
            <td style="font-weight:bold;">${c.name}${c.weight ? ` <span style="color:#9ca3af; font-weight:normal;">(${c.weight}%)</span>` : ''}</td>
            <td style="text-align:center; background:#f9fafb;">${c.max_score}</td>
            ${(event.departments || ['', '', '']).slice(0, 4).map(() => '<td style="text-align:center;"></td>').join('')}
            <td></td>
          </tr>`).join('')}
        <tr class="total-row">
          <td>TOTAL SCORE</td>
          <td class="score">${maxTotal}</td>
          ${(event.departments || ['', '', '']).slice(0, 4).map(() => '<td class="score"></td>').join('')}
          <td></td>
        </tr>
        <tr style="background:#f3e8ff;">
          <td colspan="2" style="font-weight:bold;">RANK</td>
          ${(event.departments || ['', '', '']).slice(0, 4).map(() => '<td style="text-align:center; font-size:16px; font-weight:bold;"></td>').join('')}
          <td></td>
        </tr>
      </tbody>
    </table>

    <p class="section-title">📝 Judge's Remarks &amp; Comments</p>
    <table>
      <thead><tr><th style="text-align:left; width:25%;">TEAM</th><th>OVERALL REMARKS</th><th style="width:18%;">STRENGTHS</th><th style="width:18%;">AREAS FOR IMPROVEMENT</th></tr></thead>
      <tbody>
        ${(event.departments || []).map(dept => `<tr style="height:36px;"><td style="font-weight:bold; color:#7c3aed;">${dept}</td><td></td><td></td><td></td></tr>`).join('')}
      </tbody>
    </table>

    ${signatureBlock('Judge\'s Signature &amp; Name', 'Panel Coordinator', 'Event Coordinator')}
    <div class="watermark">BatStateU ARASOF Sports Office — SportAxis System © ${new Date().getFullYear()} | For Official Use Only</div>
  </body></html>`;
}

// ── Default / Generic ─────────────────────────────────────────────────────────
function buildDefaultHtml(event: EventSession, criteria: Criterion[]): string {
  const maxTotal = criteria.reduce((s, c) => s + c.max_score, 0);
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${BASE_CSS}</style></head><body>
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
        <td colspan="3">DEPARTMENTS: ${(event.departments || []).join(' · ') || 'TBD'}</td>
      </tr>
    </table>

    <p class="section-title">📋 Scoring Criteria Evaluation (Total Max: ${maxTotal} pts)</p>
    <table class="criteria-table">
      <thead><tr>
        <th class="name-col">CRITERION</th>
        <th class="max-col">MAX SCORE</th>
        ${(event.departments || []).slice(0, 3).map(d => `<th style="width:13%;">${d}</th>`).join('')}
        ${(event.departments || []).length === 0 ? '<th class="score-col">SCORE</th>' : ''}
        <th class="notes-col">NOTES</th>
      </tr></thead>
      <tbody>
        ${criteria.map(c => `
          <tr>
            <td class="name-col">${c.name}${c.weight ? ` <span style="color:#9ca3af; font-weight:normal;">(${c.weight}%)</span>` : ''}</td>
            <td class="max-col">${c.max_score}</td>
            ${(event.departments || []).slice(0, 3).map(() => '<td style="text-align:center;"></td>').join('')}
            ${(event.departments || []).length === 0 ? '<td class="score-col"></td>' : ''}
            <td class="notes-col"></td>
          </tr>`).join('')}
        <tr class="total-row">
          <td>TOTAL SCORE</td>
          <td class="score">${maxTotal}</td>
          ${(event.departments || []).slice(0, 3).map(() => '<td class="score"></td>').join('')}
          ${(event.departments || []).length === 0 ? '<td class="score"></td>' : ''}
          <td></td>
        </tr>
      </tbody>
    </table>

    ${signatureBlock('Judge\'s Signature &amp; Name', 'Scoring Facilitator', 'Event Coordinator')}
    <div class="watermark">BatStateU ARASOF Sports Office — SportAxis System © ${new Date().getFullYear()} | For Official Use Only</div>
  </body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Router — select correct template based on sport
// ─────────────────────────────────────────────────────────────────────────────
function buildHtml(event: EventSession, criteria: Criterion[]): string {
  const config = getSportConfigFromEvent(event.category, event.name);
  switch (config.type) {
    case 'basketball':   return buildBasketballHtml(event, criteria);
    case 'volleyball':   return buildVolleyballHtml(event, criteria);
    case 'badminton':    return buildBadmintonHtml(event, criteria);
    case 'football':     return buildFootballHtml(event, criteria);
    case 'track-field':  return buildTrackFieldHtml(event, criteria);
    case 'swimming':     return buildSwimmingHtml(event, criteria);
    case 'tennis':       return buildTennisHtml(event, criteria);
    case 'table-tennis': return buildTableTennisHtml(event, criteria);
    case 'cultural':     return buildCulturalHtml(event, criteria);
    default:             return buildDefaultHtml(event, criteria);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export function PrintableScoreSheetView({ event, criteria, onClose }: PrintableScoreSheetViewProps) {
  const sportConfig = getSportConfigFromEvent(event.category, event.name);
  const accentColor = sportConfig.color;

  const handlePrint = async () => {
    try {
      const html = buildHtml(event, criteria);
      if (Platform.OS === 'web') {
        const w = window.open('', '_blank');
        w?.document.write(html);
        w?.document.close();
        w?.print();
      } else {
        await Print.printAsync({ html });
      }
    } catch (err) {
      Alert.alert('Print Error', 'Could not open print dialog. Please try sharing as PDF instead.');
    }
  };

  const handleSharePdf = async () => {
    try {
      const html = buildHtml(event, criteria);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Score Sheet — ${event.name}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Sharing not available', `PDF saved at:\n${uri}`);
      }
    } catch (err) {
      Alert.alert('Export Error', 'Could not generate PDF. Please try again.');
    }
  };

  return (
    <View style={styles.wrapper}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: accentColor }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerEmoji}>{sportConfig.emoji}</Text>
          <View>
            <Text style={styles.headerTitle}>Score Sheet</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>{event.name}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Sport Badge ──────────────────────────────────────────────────── */}
        <View style={[styles.sportBadge, { backgroundColor: `${accentColor}12`, borderColor: `${accentColor}30` }]}>
          <Ionicons name={sportConfig.icon as any} size={18} color={accentColor} />
          <Text style={[styles.sportBadgeText, { color: accentColor }]}>
            {sportConfig.label} — {sportConfig.layout === 'scoreboard' ? 'Scoreboard Form' :
             sportConfig.layout === 'set-game' ? 'Set/Game Form' :
             sportConfig.layout === 'match-game' ? 'Match Form' :
             sportConfig.layout === 'timed' ? 'Performance Record' : 'Judging Sheet'}
          </Text>
        </View>

        {/* ── Event Details Card ───────────────────────────────────────────── */}
        <Card variant="elevated" style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.detailText}>
              {event.schedule ? new Date(event.schedule).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'TBD'}
            </Text>
          </View>
          {event.venueName && (
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.detailText}>{event.venueName}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Ionicons name="people-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.detailText} numberOfLines={2}>
              {(event.departments || []).join(' vs. ') || 'No departments assigned'}
            </Text>
          </View>
        </Card>

        {/* ── Criteria Preview ─────────────────────────────────────────────── */}
        <Card variant="elevated" style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="list-outline" size={16} color={accentColor} />
            <Text style={styles.sectionTitle}>Criteria ({criteria.length})</Text>
          </View>
          {criteria.length === 0 ? (
            <Text style={styles.noCriteriaText}>No criteria defined for this event.</Text>
          ) : (
            criteria.map((c) => (
              <View key={c.criteria_id} style={styles.criterionRow}>
                <Text style={styles.criterionName} numberOfLines={1}>{c.name}</Text>
                <View style={styles.criterionBadges}>
                  {c.weight != null && (
                    <Text style={styles.weightBadgeText}>{c.weight}%</Text>
                  )}
                  <Text style={[styles.maxBadgeText, { color: accentColor, backgroundColor: `${accentColor}12` }]}>
                    max {c.max_score}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Card>

        {/* ── Info Banner ──────────────────────────────────────────────────── */}
        <View style={[styles.infoBanner, { backgroundColor: `${accentColor}08`, borderColor: `${accentColor}25` }]}>
          <Ionicons name="print-outline" size={16} color={accentColor} />
          <Text style={[styles.infoText, { color: accentColor }]}>
            The printed form contains the full {sportConfig.label} score sheet with all sections. Hand it to the judge before the event starts.
          </Text>
        </View>

        {/* ── Action Buttons ───────────────────────────────────────────────── */}
        <View style={styles.actionRow}>
          <Button
            label="Print Score Sheet"
            onPress={handlePrint}
            variant="primary"
            size="lg"
            fullWidth
            icon={<Ionicons name="print-outline" size={18} color="#fff" />}
          />
          <Button
            label="Share as PDF"
            onPress={handleSharePdf}
            variant="secondary"
            size="lg"
            fullWidth
            icon={<Ionicons name="share-outline" size={18} color={accentColor} />}
          />
        </View>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingTop: SPACING.xl,
    ...SHADOWS.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  headerEmoji: {
    fontSize: 28,
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  sportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  sportBadgeText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
  },
  detailsCard: {
    gap: SPACING.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  detailText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    flex: 1,
  },
  sectionCard: {
    gap: SPACING.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.xs,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  noCriteriaText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },
  criterionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  criterionName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textPrimary,
    flex: 1,
  },
  criterionBadges: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  weightBadgeText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  maxBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
  },
  infoText: {
    fontSize: FONT_SIZE.sm,
    lineHeight: 18,
    flex: 1,
  },
  actionRow: {
    gap: SPACING.sm,
  },
});
