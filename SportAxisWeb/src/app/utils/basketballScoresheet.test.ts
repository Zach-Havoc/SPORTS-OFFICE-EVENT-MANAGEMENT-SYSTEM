import { describe, it, expect } from 'vitest'
import { buildBasketballScoresheetHtml } from './basketballScoresheet'

/**
 * The OCR reads a college's score from the first line holding its full name,
 * so on the basketball sheet each full name must appear exactly once — in
 * the FINAL SCORE strip, beside its score box — and short names elsewhere.
 */
const home = 'College of Accountancy, Business, Economics, and International Hospitality Management'
const away = 'College of Nursing and Allied Health Sciences'
const event = {
  name: `Basketball — Men (Finals): ${home} vs ${away}`,
  schedule: '2026-09-28', startTime: '14:30', venueName: 'University Gymnasium',
  departments: [home, away],
}
const count = (html: string, s: string) => html.split(s).length - 1

describe('FIBA-style basketball scoresheet', () => {
  it('prints each full college name once, in the final score strip', () => {
    const html = buildBasketballScoresheetHtml(event, ['CABEIHM', 'CONAHS'])

    expect(count(html, home.replace(/&/g, '&amp;'))).toBe(1)
    expect(count(html, away)).toBe(1)
    const strip = html.slice(html.indexOf('<table class="final">'))
    expect(strip.indexOf(home)).toBeGreaterThan(-1)
    expect(html).toContain('Basketball — Men (Finals): CABEIHM vs CONAHS')
    expect(html).toContain('TEAM HOME<span>CABEIHM</span>')
    expect(html).toContain('2:30 PM')
  })

  it('falls back to initials when no short name is known, never the full name', () => {
    const html = buildBasketballScoresheetHtml(event, [home, undefined])

    expect(count(html, away)).toBe(1)
    expect(html).toContain('TEAM AWAY<span>CNAHS</span>')
  })

  it('has the template parts: 12 players a team, running score to 160, grand total', () => {
    const html = buildBasketballScoresheetHtml(event, ['CABEIHM', 'CONAHS'])

    expect(count(html, '<tr class="p">')).toBe(2 * (12 + 2))
    expect(html).toContain('<td class="n">160</td>')
    for (const part of ['RUNNING SCORE', 'GRAND TOTAL', 'VICTORIOUS TEAM', 'FREE THROW', 'SHOT CLOCK OPERATOR']) {
      expect(html).toContain(part)
    }
  })

  it('comes out filled in from a game recorded in the app', () => {
    const team = (score: number, coach: string, players: any[], fouls: Record<string, number>, q: number[]) => ({
      score, coach, teamFouls: fouls, players,
      periodScores: q.map((points, i) => ({ period: i + 1, label: `Q${i + 1}`, points })),
    })
    const html = buildBasketballScoresheetHtml(event, ['CABEIHM', 'CONAHS'], {
      status: 'finished',
      umpires: ['Liza Mendoza'],
      winner: 0,
      regulationPeriods: 4,
      teams: [
        team(5, 'Coach Home', [{ jersey: '7', name: 'Ana Cruz', licence: '24-12345', starter: true, played: true, fouls: ['Q1', 'Q3'] }], { 1: 1, 3: 1 }, [3, 2, 0, 0]),
        team(1, 'Coach Away', [{ jersey: '4', name: 'Bea Reyes', licence: null, starter: false, played: true, fouls: [] }], {}, [1, 0, 0, 0]),
      ],
      plays: [
        { side: 0, points: 3, jersey: '7', period: 1 },
        { side: 1, points: 1, jersey: '4', period: 1 },
        { side: 0, points: 2, jersey: null, period: 2 },
      ],
    })

    expect(html).toContain('OFFICIAL RECORD')
    expect(html).toContain('<td class="score">5</td>')
    expect(html).toContain('<td class="score">1</td>')
    expect(html).toContain('24-12345')
    expect(html).toContain('<span class="in starter">X</span>')
    expect(html).toContain('<td class="foul">Q3</td>')
    expect(html).toContain('<span class="j three">7</span>')   // a three: the jersey circled
    expect(html).toContain('<span class="j">–</span>')         // a basket with no player named
    expect(html).toContain('class="n ft')                      // the free throw
    expect(html).toContain('VICTORIOUS TEAM:<span class="v" style="font-size:10pt;">CABEIHM</span>')
    expect(html).toContain('HEAD COACH<span class="v">Coach Home</span>')
    expect(html).toContain('CABEIHM: <b>3</b>')
    // The full college name still appears only once, for the OCR.
    expect(count(html, away)).toBe(1)
  })

  it('marks a game still in progress as not final', () => {
    const html = buildBasketballScoresheetHtml(event, [], { status: 'live', teams: [], plays: [] })
    expect(html).toContain('GAME IN PROGRESS — NOT FINAL')
  })

  it('crosses off the time-outs taken, by half and overtime', () => {
    const t = (timeouts: Record<string, number>) => ({ score: 0, periodScores: [], teamFouls: {}, timeouts, players: [] })
    const html = buildBasketballScoresheetHtml(event, [], {
      status: 'finished', teams: [t({ h1: 1, h2: 3, ot1: 1 }), t({})], plays: [],
    })
    // Home: 1 + 3 + 1 time-out boxes filled; away none; no team fouls.
    expect(count(html, 'class="box x"')).toBe(5)
  })
})
