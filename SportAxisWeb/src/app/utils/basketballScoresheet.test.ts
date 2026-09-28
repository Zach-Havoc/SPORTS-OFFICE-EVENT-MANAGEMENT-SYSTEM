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
})
