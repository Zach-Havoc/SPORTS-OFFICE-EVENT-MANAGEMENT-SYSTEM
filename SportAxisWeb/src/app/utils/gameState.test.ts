import { describe, it, expect } from 'vitest';
import { gameState, queuedBehindEarlier, scoreboardFor } from './games';

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

describe('the schedule fallback only claims a game that can be under way', () => {
  it('keeps a bracket slot with no teams yet (TBA vs TBA) as Upcoming', () => {
    expect(gameState(game({ startTime: '08:00', departments: [] }), null, null, now)).toBe('upcoming');
    expect(gameState(game({ startTime: '08:00', departments: ['TBD', 'TBD'] }), null, null, now)).toBe('upcoming');
  });

  it('keeps a game queued behind an unfinished earlier one on the same table as Upcoming', () => {
    const day = [
      { id: 'a', status: 'upcoming', schedule: '2026-10-03', startTime: '08:00', venueName: 'Table 1' },
      { id: 'b', status: 'upcoming', schedule: '2026-10-03', startTime: '09:00', venueName: 'Table 1' },
      { id: 'c', status: 'upcoming', schedule: '2026-10-03', startTime: '09:00', venueName: 'Table 2' },
    ];
    const queued = queuedBehindEarlier(day);
    expect([...queued]).toEqual(['b']);
    expect(gameState(game({ startTime: '08:00' }), null, null, now)).toBe('in_progress');
    expect(gameState(game({ startTime: '09:00', waitingOnEarlier: true }), null, null, now)).toBe('upcoming');

    // Once the 8:00 game has its result, the 9:00 game is free to start.
    expect([...queuedBehindEarlier(day, (id) => id === 'a')]).toEqual([]);
  });

  it('still trusts a committee that pressed Start, queue or not', () => {
    const paper = live({ method: 'paper' });
    expect(gameState(game({ status: 'ongoing', waitingOnEarlier: true }), paper, null, now)).toBe('in_progress');
  });
});

