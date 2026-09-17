import { describe, expect, it } from 'vitest';
import { buildScoreSheetHtml } from './scoresheet';

describe('buildScoreSheetHtml', () => {
  it('produces the basketball sheet with a running score and per-team fouls', () => {
    const html = buildScoreSheetHtml({
      name: 'Basketball (Finals): CET vs CICS',
      category: 'Basketball',
      departments: ['CET', 'CICS'],
    });
    expect(html).toContain('Official Basketball Game Score Sheet');
    expect(html).toContain('RUNNING SCORE:');
    expect(html).toContain('1ST QTR');
    expect(html).toContain('Player Roster &amp; Fouls');
    expect(html).toContain('CET');
  });

  it('gives a badminton line its 3-game rally sheet', () => {
    const html = buildScoreSheetHtml({ name: 'Badminton — M Doubles', category: 'Badminton — M Doubles' });
    expect(html).toContain('Official Badminton Match Score Sheet');
    expect(html).toContain('GAME 1 — Rally Tracker');
    expect(html).toContain('GAME 3 — Rally Tracker');
  });

  it('routes "Table Tennis" to the table tennis sheet, not tennis', () => {
    const html = buildScoreSheetHtml({ name: 'Table Tennis — M Singles A', category: 'Table Tennis — M Singles A' });
    expect(html).toContain('Official Table Tennis Match Score Sheet');
    expect(html).toContain('Best of 5');
  });

  it('uses the performance-record sheet for track & field', () => {
    const html = buildScoreSheetHtml({
      name: '100m Dash',
      category: 'Track & Field',
      departments: ['CET', 'CICS', 'CABEIHM'],
    });
    expect(html).toContain('Track &amp; Field Performance Record Sheet');
    expect(html).toContain('Athlete Performance Records');
    expect(html).not.toContain('RUNNING SCORE:');
  });

  it('falls back to the generic overall sheet for an unlisted sport', () => {
    const html = buildScoreSheetHtml({ name: 'Chess Open', category: 'Chess', departments: ['CET'] });
    expect(html).toContain('Official Event Score Sheet');
    expect(html).toContain('Overall Score Sheet');
  });
});
