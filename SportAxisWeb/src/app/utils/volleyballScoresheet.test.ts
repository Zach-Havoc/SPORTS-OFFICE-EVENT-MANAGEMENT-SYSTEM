import { describe, it, expect } from 'vitest'
import { buildVolleyballScoresheetHtml } from './volleyballScoresheet'
import { buildScoreSheetHtml } from './scoresheet'

/**
 * The FIVB-style volleyball sheet. As with basketball, the OCR reads a
 * college's result from the first line holding its full name, so each full
 * name appears exactly once — in the MATCH RESULT strip, beside its box.
 */
const home = 'College of Teacher Education'
const away = 'Laboratory School'
const event = {
  name: `Volleyball — Women (Round 3): ${home} vs ${away}`,
  category: 'Volleyball — Women',
  schedule: '2026-09-22', startTime: '11:45', venueName: 'Covered Court B',
  departments: [home, away],
}
const count = (html: string, s: string) => html.split(s).length - 1

const setTeam = (points: number, extra: Record<string, unknown> = {}) => ({
  points, starting: ['10', '4', '8', '15', '13', '1'], subs: [], rounds: [[], [], [], [], [], []], timeouts: [], ...extra,
})

describe('FIVB-style volleyball scoresheet', () => {
  it('prints each full college name once, in the match result strip, and the short names elsewhere', () => {
    const html = buildVolleyballScoresheetHtml(event, ['CTE', 'LS'])

    expect(count(html, home)).toBe(1)
    expect(count(html, away)).toBe(1)
    expect(html.indexOf(home)).toBeGreaterThan(html.indexOf('<table class="final">'))
    expect(html).toContain('Volleyball — Women (Round 3): CTE vs LS')
    expect(count(html, '<div class="set">')).toBe(5)
    expect(html).toContain('size: 13in 8.5in')
    expect(html).toContain('<span class="ck">✕</span>Women')
  })

  it('comes out filled in from a match recorded in the app', () => {
    const html = buildVolleyballScoresheetHtml(event, ['CTE', 'LS'], {
      status: 'finished',
      winner: 1,
      umpires: ['Noel Perez'],
      teams: [
        { setsWon: 0, coach: 'Ernesto Torres', players: [{ jersey: '10', name: 'Rica Atienza', licence: '24-27705' }] },
        { setsWon: 1, coach: 'Marites Atienza', players: [] },
      ],
      sets: [{
        number: 1, target: 25, firstServer: 1, winner: 1,
        startedAt: '2026-09-22T11:48:00+08:00', endedAt: '2026-09-22T12:09:00+08:00',
        teams: [
          setTeam(12, { rounds: [[{ x: true }, { score: 12 }], [{ score: 1 }], [], [], [], []], timeouts: ['7:12'] }),
          setTeam(25, { rounds: [[{ score: 1 }, { score: 25, last: true }], [], [], [], [], []], subs: [{ column: 2, jersey: '7', score: '15:10' }] }),
        ],
      }],
    })

    expect(html).toContain('OFFICIAL RECORD')
    expect(html).toContain('<span class="x">✕</span>')                 // CTE received first
    expect(html).toContain('<span class="last">25</span>')             // LS's last point
    expect(html).toContain('<td class="t">7:12</td>')                   // CTE's time-out
    expect(html).toContain('15:10')                                     // LS's substitution
    expect(html).toContain('(21)')                                      // set 1 took 21 minutes
    expect(html).toContain('<td class="score">1</td>')                  // LS: 1 set
    expect(html).toContain('24-27705')
    expect(html).toContain('Ernesto Torres')
    expect(count(html, home)).toBe(1)
  })

  it('is what indoor volleyball prints; beach volleyball keeps its own sheet', () => {
    expect(buildScoreSheetHtml({ ...event, category: 'Volleyball — Women' })).toContain('VOLLEYBALL SCORESHEET')
    const beach = buildScoreSheetHtml({ ...event, name: 'Beach Volleyball — Men: CICS vs CAS', category: 'Beach Volleyball — Men' })
    expect(beach).not.toContain('VOLLEYBALL SCORESHEET')
    expect(beach).toContain('Official Volleyball Match Score Sheet')
  })
})
