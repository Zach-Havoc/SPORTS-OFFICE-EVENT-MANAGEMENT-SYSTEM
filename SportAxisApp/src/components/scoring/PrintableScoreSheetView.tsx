import { Icon, type IconName } from '../ui/Icon';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
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
import type { EventSession } from '../../types';
import { getSportConfigFromEvent } from '../../utils/sport-config';
import { buildBasketballScoresheetHtml, type FilledBasketballGame } from '../../utils/basketballScoresheet';
import { basketballService } from '../../services/basketball.service';
import { buildVolleyballScoresheetHtml, type FilledVolleyballGame } from '../../utils/volleyballScoresheet';
import { volleyballService } from '../../services/volleyball.service';
import { useDeptAbbreviator } from '../../hooks/use-dept-abbr';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

// ─────────────────────────────────────────────────────────────────────────────
// PrintableScoreSheetView — Generates sport-specific printable HTML score sheets
// ─────────────────────────────────────────────────────────────────────────────

interface PrintableScoreSheetViewProps {
  event: EventSession;
  onClose?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared CSS injected into every HTML template
// ─────────────────────────────────────────────────────────────────────────────
// Printed on "long" bond paper (8.5 x 13in — the Philippine standard, distinct
// from US Legal's 8.5 x 14in), landscape. Landscape gives the wide
// point-by-point logs (volleyball/badminton/table tennis) room to breathe and
// lets a team's two roster panels sit side by side instead of stacked, which
// also means bigger, better-separated handwriting cells — directly helps a
// judge later re-scanning this sheet with OCR, not just readability on paper.
const PAGE_CSS = `@page { size: 13in 8.5in; margin: 8mm; }`;

const BASE_CSS = `
  ${PAGE_CSS}
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12.5px; color: #111; background: #fff; padding: 14px; }
  h1 { font-size: 19px; font-weight: 900; text-transform: uppercase; color: #991b1b; letter-spacing: 0.3px; }
  h2 { font-size: 13px; font-weight: 800; text-transform: uppercase; }
  .header { text-align: center; border-bottom: 3px solid #b91c1c; padding-bottom: 10px; margin-bottom: 12px; }
  .header p { font-size: 11.5px; color: #374151; text-transform: uppercase; font-weight: bold; margin-top: 3px; }
  .badge { display: inline-block; padding: 3px 10px; background: #fee2e2; color: #991b1b; font-weight: bold; font-size: 11px; border-radius: 4px; border: 1px solid #fca5a5; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 11px; }
  th, td { border: 1.5px solid #000; padding: 6px; font-size: 11.5px; }
  th { background: #b91c1c; color: #fff; font-weight: bold; text-align: center; }
  .meta-table td { font-size: 11.5px; font-weight: bold; padding: 7px; }
  .score-table td { height: 26px; }
  .score-sheet-table th { background: #374151; }
  .score-sheet-table td.name-col { font-weight: bold; width: 45%; }
  .score-sheet-table td.max-col { text-align: center; width: 12%; background: #f9fafb; }
  .score-sheet-table td.score-col { text-align: center; width: 20%; }
  .score-sheet-table td.notes-col { width: 23%; }
  .section-title { font-size: 12px; font-weight: bold; background: #1f2937; color: #fff; padding: 5px 9px; margin-bottom: 7px; text-transform: uppercase; letter-spacing: 0.5px; }
  .sig-line { border-bottom: 1.5px solid #000; margin-top: 24px; width: 100%; }
  .sig-label { font-size: 10px; text-align: center; margin-top: 4px; }
  .sig-section { width: 100%; }
  .sig-row { display: flex; justify-content: space-between; gap: 24px; margin-top: 14px; }
  .sig-item { flex: 1; }
  .score-box { display: inline-block; width: 40px; height: 24px; border: 1.5px solid #000; text-align: center; line-height: 24px; }
  .foul-box { display: inline-block; width: 17px; height: 17px; border: 1px solid #000; text-align: center; line-height: 17px; font-size: 9px; margin: 0 1.5px; }
  .red-row { background: #fee2e2; }
  .blue-row { background: #dbeafe; }
  .green-row { background: #dcfce7; }
  .purple-row { background: #f3e8ff; }
  .total-row td { background: #1f2937 !important; color: #fff !important; font-weight: bold; font-size: 13px; }
  .total-row td.score { background: #b91c1c !important; font-size: 15px; text-align: center; }
  .watermark { font-size: 9.5px; color: #9ca3af; text-align: center; margin-top: 13px; border-top: 1px dashed #d1d5db; padding-top: 7px; }
  .two-col { display: flex; gap: 14px; }
  .two-col > div { flex: 1; min-width: 0; }
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

function signatureBlock(role1: string, role2: string, role3: string) {
  return `
    <div class="sig-row">
      <div class="sig-item"><div class="sig-line"></div><div class="sig-label">${role1}</div></div>
      <div class="sig-item"><div class="sig-line"></div><div class="sig-label">${role2}</div></div>
      <div class="sig-item"><div class="sig-line"></div><div class="sig-label">${role3}</div></div>
    </div>`;
}

// ── Basketball ────────────────────────────────────────────────────────────────
// The FIBA-style sheet lives in src/utils/basketballScoresheet.ts (the same
// file as the web app's — keep them identical). It's printed portrait.

// ── Volleyball ────────────────────────────────────────────────────────────────
// Indoor volleyball prints the FIVB-style sheet in src/utils/volleyballScoresheet.ts
// (the same file as the web app's — keep them identical). Beach volleyball —
// pairs, no rotation — keeps the simple set sheet below.
const isBeach = (event: EventSession) => /beach/i.test(`${event.category} ${event.name}`);

function buildBeachVolleyballHtml(event: EventSession): string {
  const depts = event.departments || [];
  const teamA = depts[0] || 'TEAM A';
  const teamB = depts[1] || 'TEAM B';
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${BASE_CSS}</style></head><body>
    <div class="header">
      <h1>SportsAxis – Sports Office</h1>
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

    ${signatureBlock('Committee\'s Signature &amp; Name', 'Libero Tracker / Scorekeeper', 'Event Coordinator')}
    <div class="watermark">SportsAxis System © ${new Date().getFullYear()} | For Official Use Only</div>
  </body></html>`;
}

// ── Badminton ─────────────────────────────────────────────────────────────────
function buildBadmintonHtml(event: EventSession): string {
  const depts = event.departments || [];
  const playerA = depts[0] || 'PLAYER A';
  const playerB = depts[1] || 'PLAYER B';
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${BASE_CSS}</style></head><body>
    <div class="header">
      <h1>SportsAxis – Sports Office</h1>
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

    <p class="section-title">Game Scores (Best of 3 Games – 21 pts each)</p>
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

    <p class="section-title">Point-by-Point Rally Log</p>
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

    ${signatureBlock('Committee\'s Signature &amp; Name', 'Umpire / Scorekeeper', 'Event Coordinator')}
    <div class="watermark">SportsAxis System © ${new Date().getFullYear()} | For Official Use Only</div>
  </body></html>`;
}

// ── Football ──────────────────────────────────────────────────────────────────
function buildFootballHtml(event: EventSession): string {
  const depts = event.departments || [];
  const teamA = depts[0] || 'TEAM A';
  const teamB = depts[1] || 'TEAM B';
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${BASE_CSS}</style></head><body>
    <div class="header">
      <h1>SportsAxis – Sports Office</h1>
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

    ${signatureBlock('Committee\'s Signature &amp; Name', 'Referee / Scorekeeper', 'Event Coordinator')}
    <div class="watermark">SportsAxis System © ${new Date().getFullYear()} | For Official Use Only</div>
  </body></html>`;
}

// ── Track & Field ─────────────────────────────────────────────────────────────
function buildTrackFieldHtml(event: EventSession): string {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${BASE_CSS}</style></head><body>
    <div class="header">
      <h1>SportsAxis – Sports Office</h1>
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

    ${signatureBlock('Committee\'s Signature &amp; Name', 'Official Timer / Measurer', 'Event Coordinator')}
    <div class="watermark">SportsAxis System © ${new Date().getFullYear()} | For Official Use Only</div>
  </body></html>`;
}

// ── Swimming ──────────────────────────────────────────────────────────────────
function buildSwimmingHtml(event: EventSession): string {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${BASE_CSS}</style></head><body>
    <div class="header">
      <h1>SportsAxis – Sports Office</h1>
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

    <p class="section-title">Lane & Time Record</p>
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

    ${signatureBlock('Committee\'s Signature &amp; Name', 'Official Timer / Stroke Committee', 'Event Coordinator')}
    <div class="watermark">SportsAxis System © ${new Date().getFullYear()} | For Official Use Only</div>
  </body></html>`;
}

// ── Tennis ────────────────────────────────────────────────────────────────────
function buildTennisHtml(event: EventSession): string {
  const depts = event.departments || [];
  const playerA = depts[0] || 'PLAYER A';
  const playerB = depts[1] || 'PLAYER B';
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${BASE_CSS}</style></head><body>
    <div class="header">
      <h1>SportsAxis – Sports Office</h1>
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

    <p class="section-title">Set & Game Scores</p>
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

    ${signatureBlock('Committee\'s Signature &amp; Name', 'Chair Umpire / Scorekeeper', 'Event Coordinator')}
    <div class="watermark">SportsAxis System © ${new Date().getFullYear()} | For Official Use Only</div>
  </body></html>`;
}

// ── Table Tennis ──────────────────────────────────────────────────────────────
function buildTableTennisHtml(event: EventSession): string {
  const depts = event.departments || [];
  const playerA = depts[0] || 'PLAYER A';
  const playerB = depts[1] || 'PLAYER B';
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${BASE_CSS}</style></head><body>
    <div class="header">
      <h1>SportsAxis – Sports Office</h1>
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

    <p class="section-title">Game Scores (Best of 5 – 11 pts each)</p>
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

    <p class="section-title">Point Log per Game (11 pts = 1 game)</p>
    ${[1, 2, 3, 4, 5].map(g => `
      <table>
        <thead><tr><th colspan="13" style="background:#0f766e;">GAME ${g} — Points (circle point as scored)</th></tr>
        <tr><th style="text-align:left;width:18%;">PLAYER</th>${Array.from({ length: 12 }).map((_, i) => `<th style="width:6.7%;">${i + 1}</th>`).join('')}</tr></thead>
        <tbody>
          <tr style="background:#ccfbf1;"><td style="font-weight:bold;">${playerA}</td>${Array.from({ length: 12 }).map(() => '<td></td>').join('')}</tr>
          <tr><td style="font-weight:bold;">${playerB}</td>${Array.from({ length: 12 }).map(() => '<td></td>').join('')}</tr>
        </tbody>
      </table>`).join('')}

    ${signatureBlock('Committee\'s Signature &amp; Name', 'Umpire / Scorekeeper', 'Event Coordinator')}
    <div class="watermark">SportsAxis System © ${new Date().getFullYear()} | For Official Use Only</div>
  </body></html>`;
}

// ── Cultural / Arts ───────────────────────────────────────────────────────────
function buildCulturalHtml(event: EventSession): string {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${BASE_CSS}
    .perf-header { background: #7c3aed; color: #fff; padding: 6px 10px; font-weight: bold; font-size: 11px; border-radius: 4px; margin-bottom: 6px; }
  </style></head><body>
    <div class="header">
      <h1>SportsAxis – Sports Office</h1>
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
        ${(event.departments || []).map((dept, i) => `<tr><td style="text-align:center;">${i + 1}</td><td style="font-weight:bold; color:#7c3aed;">${dept}</td><td></td><td></td><td style="text-align:center;"></td></tr>`).join('')}
        ${Array.from({ length: Math.max(0, 3 - (event.departments || []).length) }).map((_, i) => `<tr><td style="text-align:center;">${(event.departments || []).length + i + 1}</td><td></td><td></td><td></td><td></td></tr>`).join('')}
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
        ${(event.departments || ['', '', '']).map(dept => `
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
        ${(event.departments || []).map(dept => `<tr style="height:36px;"><td style="font-weight:bold; color:#7c3aed;">${dept}</td><td></td><td></td><td></td></tr>`).join('')}
      </tbody>
    </table>

    ${signatureBlock('Committee\'s Signature &amp; Name', 'Panel Coordinator', 'Event Coordinator')}
    <div class="watermark">SportsAxis System © ${new Date().getFullYear()} | For Official Use Only</div>
  </body></html>`;
}

// ── Default / Generic ─────────────────────────────────────────────────────────
function buildDefaultHtml(event: EventSession): string {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${BASE_CSS}</style></head><body>
    <div class="header">
      <h1>SportsAxis – Sports Office</h1>
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

    <p class="section-title">Overall Score Sheet (Max 100 per team)</p>
    <table class="score-sheet-table">
      <thead><tr>
        <th class="name-col">TEAM / DEPARTMENT</th>
        <th class="score-col">OVERALL SCORE (0–100)</th>
        <th style="width:12%;">RANK</th>
        <th class="notes-col">NOTES</th>
      </tr></thead>
      <tbody>
        ${(event.departments || ['']).map(dept => `
          <tr style="height:30px;">
            <td class="name-col">${dept}</td>
            <td class="score-col"></td>
            <td style="text-align:center; font-weight:bold;"></td>
            <td class="notes-col"></td>
          </tr>`).join('')}
      </tbody>
    </table>

    ${signatureBlock('Committee\'s Signature &amp; Name', 'Scoring Facilitator', 'Event Coordinator')}
    <div class="watermark">SportsAxis System © ${new Date().getFullYear()} | For Official Use Only</div>
  </body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Router — select correct template based on sport
// ─────────────────────────────────────────────────────────────────────────────
/**
 * `labels`: the teams' short names (CICS…), for sheets that print them.
 * `game`: a basketball game or volleyball match recorded in the app — its
 * sheet comes out filled in.
 */
type FilledGame = { sport: 'basketball'; data: FilledBasketballGame } | { sport: 'volleyball'; data: FilledVolleyballGame };

function buildHtml(event: EventSession, labels: string[] = [], game?: FilledGame): string {
  const config = getSportConfigFromEvent(event.category, event.name);
  switch (config.type) {
    case 'basketball':
      return buildBasketballScoresheetHtml(event, labels, game?.sport === 'basketball' ? game.data : undefined);
    case 'volleyball':
      return isBeach(event)
        ? buildBeachVolleyballHtml(event)
        : buildVolleyballScoresheetHtml(event, labels, game?.sport === 'volleyball' ? game.data : undefined);
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

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
// Long bond paper (8.5 x 13in), landscape, expressed in the pixel units
// expo-print expects (72 PPI — its own default is US Letter, 612x792). The
// basketball sheet is the one portrait sheet.
const LONG_SIDE_PX = 13 * 72;
const SHORT_SIDE_PX = 8.5 * 72;

export function PrintableScoreSheetView({ event, onClose }: PrintableScoreSheetViewProps) {
  const sportConfig = getSportConfigFromEvent(event.category, event.name);
  const accentColor = sportConfig.color;
  const abbreviate = useDeptAbbreviator();
  const labels = (event.departments ?? []).map((d) => abbreviate(d));
  const portrait = sportConfig.type === 'basketball';
  const PAGE_WIDTH_PX = portrait ? SHORT_SIDE_PX : LONG_SIDE_PX;
  const PAGE_HEIGHT_PX = portrait ? LONG_SIDE_PX : SHORT_SIDE_PX;

  // A basketball game or (indoor) volleyball match scored in the app can be
  // printed filled in with everything recorded. Loaded quietly: offline, not
  // this game's committee, or nothing played yet — the blank sheet is all
  // that's offered.
  const [game, setGame] = useState<FilledGame | null>(null);
  const [filled, setFilled] = useState(true);
  const beach = isBeach(event);
  useEffect(() => {
    let alive = true;
    const load: Promise<FilledGame | null> | null =
      sportConfig.type === 'basketball'
        ? basketballService.scoresheet(event.id).then((d) => (d.plays.length > 0 ? { sport: 'basketball', data: d } : null))
        : sportConfig.type === 'volleyball' && !beach
          ? volleyballService.scoresheet(event.id).then((d) => (d.sets.length > 0 ? { sport: 'volleyball', data: d } : null))
          : null;
    load
      ?.then((g) => {
        if (alive && g) setGame(g);
      })
      .catch(() => { /* blank sheet only */ });
    return () => {
      alive = false;
    };
  }, [event.id, sportConfig.type, beach]);
  const useGame = game && filled ? game : undefined;

  const handlePrint = async () => {
    try {
      const html = buildHtml(event, labels, useGame);
      if (Platform.OS === 'web') {
        const w = window.open('', '_blank');
        w?.document.write(html);
        w?.document.close();
        w?.print();
      } else {
        await Print.printAsync({
          html,
          width: PAGE_WIDTH_PX,
          height: PAGE_HEIGHT_PX,
          orientation: portrait ? Print.Orientation.portrait : Print.Orientation.landscape,
        });
      }
    } catch (err) {
      console.error('Print error:', err);
      Alert.alert('Print Error', 'Could not open print dialog. Please try sharing as PDF instead.');
    }
  };

  const handleSharePdf = async () => {
    try {
      const html = buildHtml(event, labels, useGame);
      const { uri } = await Print.printToFileAsync({
        html,
        width: PAGE_WIDTH_PX,
        height: PAGE_HEIGHT_PX,
      });
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
      console.error('Share PDF error:', err);
      Alert.alert('Export Error', 'Could not generate PDF. Please try again.');
    }
  };

  return (
    <View style={styles.wrapper}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: accentColor }]}>
        <View style={styles.headerLeft}>
          <Icon name={sportConfig.icon as IconName} size={22} color="#fff" strokeWidth={2.2} />
          <View>
            <Text style={styles.headerTitle}>Score Sheet</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>{event.name}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Icon name="close" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Sport Badge ──────────────────────────────────────────────────── */}
        <View style={[styles.sportBadge, { backgroundColor: `${accentColor}12`, borderColor: `${accentColor}30` }]}>
          <Icon name={sportConfig.icon as IconName} size={18} color={accentColor} strokeWidth={2.2} />
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
            <Icon name="calendar" size={14} color={COLORS.textSecondary} />
            <Text style={styles.detailText}>
              {event.schedule ? new Date(event.schedule).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'TBD'}
            </Text>
          </View>
          {event.venueName && (
            <View style={styles.detailRow}>
              <Icon name="location" size={14} color={COLORS.textSecondary} />
              <Text style={styles.detailText}>{event.venueName}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Icon name="users" size={14} color={COLORS.textSecondary} />
            <Text style={styles.detailText} numberOfLines={2}>
              {(event.departments || []).join(' vs. ') || 'No departments assigned'}
            </Text>
          </View>
        </Card>

        {/* ── Filled or blank (a game scored in the app) ────────────────────── */}
        {game && (
          <View style={styles.choiceRow}>
            {([
              [
                true,
                'Filled from this game',
                game.data.status !== 'finished'
                  ? 'So far — the game isn’t finished'
                  : game.sport === 'volleyball'
                    ? 'Line-ups, service rounds, points, time-outs and result'
                    : 'Rosters, fouls, running score and final',
              ],
              [false, 'Blank sheet', 'To score on paper'],
            ] as const).map(([value, title, sub]) => (
              <TouchableOpacity
                key={title}
                onPress={() => setFilled(value)}
                style={[styles.choice, filled === value && { borderColor: accentColor, backgroundColor: `${accentColor}0D` }]}
                accessibilityRole="radio"
                accessibilityState={{ checked: filled === value }}
              >
                <Text style={[styles.choiceTitle, filled === value && { color: accentColor }]}>{title}</Text>
                <Text style={styles.choiceSub}>{sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Info Banner ──────────────────────────────────────────────────── */}
        <View style={[styles.infoBanner, { backgroundColor: `${accentColor}08`, borderColor: `${accentColor}25` }]}>
          <Icon name="print" size={16} color={accentColor} />
          <Text style={[styles.infoText, { color: accentColor }]}>
            {useGame
              ? useGame.sport === 'volleyball'
                ? 'The PDF comes out filled in with this match as recorded in the app — each set’s line-ups, substitutions, service rounds, points, time-outs, start and end times, the results and the officials. Share it as the match’s soft copy.'
                : 'The PDF comes out filled in with this game as recorded in the app — rosters, fouls, team fouls, the running score, quarter scores, the final and the officials. Share it as the game’s soft copy.'
              : `The printed form contains the full ${sportConfig.label} score sheet with all sections. Hand it to the committee before the event starts.`}
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
            icon={<Icon name="print" size={18} color="#fff" />}
          />
          <Button
            label="Share as PDF"
            onPress={handleSharePdf}
            variant="secondary"
            size="lg"
            fullWidth
            icon={<Icon name="share" size={18} color={accentColor} />}
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
  choiceRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  choice: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  choiceTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  choiceSub: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
