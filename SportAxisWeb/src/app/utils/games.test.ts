import { describe, expect, it } from 'vitest';
import { formatRecord, recordsBySport, scoreboardFor, type MatchRow } from './games';

const match = (o: Partial<MatchRow>): MatchRow => ({
  eventId: 'e1', sport: 'Basketball', homeTeam: 'CICS', awayTeam: 'CET',
  homeScore: 0, awayScore: 0, winner: null, isDraw: false, status: 'completed', ...o,
});

describe('scoreboardFor', () => {
  it('prefers a running live score and marks it live', () => {
    const b = scoreboardFor(['CICS', 'CET'], {
      homeTeam: 'CICS', awayTeam: 'CET', homeScore: 40, awayScore: 38, period: 'Q3', status: 'in_progress',
    }, match({ homeScore: 1, awayScore: 2 }));
    expect(b).toMatchObject({ live: true, period: 'Q3', winner: null, home: { score: 40 }, away: { score: 38 } });
  });

  it('uses the recorded result when there is no live score', () => {
    const b = scoreboardFor(['CICS', 'CET'], null, match({ homeScore: '114.00', awayScore: '128.00', winner: 'CET' }));
    expect(b).toMatchObject({ live: false, winner: 'away', home: { score: 114 }, away: { score: 128 } });
  });

  it('reports a draw', () => {
    expect(scoreboardFor([], null, match({ homeScore: 2, awayScore: 2, isDraw: true })).winner).toBe('draw');
  });

  it('shows the two colleges without scores before the game', () => {
    const b = scoreboardFor(['CICS', 'CET']);
    expect(b).toMatchObject({ winner: null, home: { team: 'CICS', score: null }, away: { team: 'CET', score: null } });
  });
});

describe('recordsBySport', () => {
  it('tallies wins, losses and draws per sport', () => {
    const r = recordsBySport([
      match({ winner: 'CICS' }),
      match({ winner: 'CET' }),
      match({ isDraw: true }),
      match({ sport: 'Volleyball', winner: 'CICS' }),
      match({ status: 'scheduled', winner: 'CICS' }),
    ]);
    expect(formatRecord(r.get('Basketball|CICS'))).toBe('1-1-1');
    expect(formatRecord(r.get('Volleyball|CICS'))).toBe('1-0');
    expect(formatRecord(r.get('Volleyball|CET'))).toBe('0-1');
  });

  it('only counts matches the filter lets through', () => {
    const r = recordsBySport([match({ eventId: 'old', winner: 'CICS' }), match({ eventId: 'new', winner: 'CET' })], (m) => m.eventId === 'new');
    expect(formatRecord(r.get('Basketball|CICS'))).toBe('0-1');
  });
});
