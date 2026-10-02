import { describe, it, expect } from 'vitest';
import { gameState, scoreboardFor } from './games';

/**
 * What the public is told about a game. A committee can score live in the
 * app or on the paper sheet; a paper game has no running score, so it reads
 * "In progress" instead of "Live", and its final looks like any other.
 */
const now = new Date(2026, 9, 3, 14, 30); // Oct 3, 2:30 PM
const game = (over: Record<string, unknown> = {}) => ({
  status: 'upcoming',
  schedule: '2026-10-03',
  startTime: '15:00',
  departments: ['CICS', 'CET'],
  ...over,
});
const live = (over: Record<string, unknown> = {}) => ({
  homeTeam: 'CICS', awayTeam: 'CET', homeScore: 12, awayScore: 9, period: 'Set 2',
  status: 'in_progress' as const, ...over,
});

describe('gameState', () => {
  it('is Live while the committee scores in the app', () => {
    expect(gameState(game({ status: 'ongoing' }), live(), null, now)).toBe('live');
  });

  it('is In progress, with no score, while it is scored on paper', () => {
    const paper = live({ method: 'paper', homeScore: 0, awayScore: 0 });
    expect(gameState(game({ status: 'ongoing' }), paper, null, now)).toBe('in_progress');
    const board = scoreboardFor(['CICS', 'CET'], paper);
    expect(board).toMatchObject({ live: false, onPaper: true, home: { score: null }, away: { score: null } });
  });

  it('is In progress once its start time passes today, even if nobody pressed Start', () => {
    expect(gameState(game({ startTime: '14:00' }), null, null, now)).toBe('in_progress');
    expect(gameState(game({ startTime: '15:00' }), null, null, now)).toBe('upcoming');
  });

  it('is Result pending on a later day when no result was recorded', () => {
    expect(gameState(game({ schedule: '2026-10-02' }), null, null, now)).toBe('result_pending');
    expect(gameState(game({ schedule: '2026-10-02', status: 'ongoing' }), null, null, now)).toBe('result_pending');
  });

  it('is Completed the same way whether the final came live or from the sheet', () => {
    expect(gameState(game(), live({ status: 'final', method: 'paper' }), null, now)).toBe('completed');
    expect(gameState(game(), live({ status: 'final' }), null, now)).toBe('completed');
    const sheetFinal = scoreboardFor(['CICS', 'CET'], live({ status: 'final', method: 'paper', homeScore: 3, awayScore: 1 }));
    expect(sheetFinal).toMatchObject({ winner: 'home', onPaper: false, home: { score: 3 } });
  });
});
