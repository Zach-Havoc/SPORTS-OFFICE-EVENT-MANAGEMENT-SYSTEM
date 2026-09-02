import { describe, it, expect } from 'vitest'
import { makeAbbreviator, deptAcronym, shortDeptLabel } from './departments'

/**
 * makeAbbreviator(departments) -> (text) => text with every full department
 * name swapped for its abbreviation.
 */
describe('makeAbbreviator', () => {
  const depts = [
    { name: 'College of Engineering', abbreviation: 'CoE' },
    { name: 'College of Nursing', abbreviation: 'CN' },
    { name: 'College of Nursing and Allied Health Sciences', abbreviation: 'CNAHS' },
    { name: 'College of Arts and Sciences', abbreviation: '' }, // no abbreviation set
  ]

  it('replaces a full department name with its abbreviation', () => {
    const abbr = makeAbbreviator(depts)
    expect(abbr('Basketball: College of Engineering vs College of Nursing')).toBe(
      'Basketball: CoE vs CN',
    )
  })

  it('matches case-insensitively', () => {
    const abbr = makeAbbreviator(depts)
    expect(abbr('COLLEGE OF ENGINEERING')).toBe('CoE')
  })

  it('prefers the longest matching name (compound beats its prefix)', () => {
    const abbr = makeAbbreviator(depts)
    // Must become "CNAHS", not "CN and Allied Health Sciences".
    expect(abbr('Round 6: College of Nursing and Allied Health Sciences')).toBe('Round 6: CNAHS')
  })

  it('leaves department names with no abbreviation unchanged', () => {
    const abbr = makeAbbreviator(depts)
    expect(abbr('College of Arts and Sciences')).toBe('College of Arts and Sciences')
  })

  it('leaves unrelated text untouched', () => {
    const abbr = makeAbbreviator(depts)
    expect(abbr('Volleyball Finals')).toBe('Volleyball Finals')
  })

  it('handles empty / null / undefined input safely', () => {
    const abbr = makeAbbreviator(depts)
    expect(abbr('')).toBe('')
    expect(abbr(null)).toBe('')
    expect(abbr(undefined)).toBe('')
  })

  it('is a no-op when no departments are supplied', () => {
    expect(makeAbbreviator([])('College of Engineering')).toBe('College of Engineering')
    expect(makeAbbreviator(undefined)('anything')).toBe('anything')
  })

  it('escapes regex metacharacters in department names', () => {
    const abbr = makeAbbreviator([{ name: 'A+ (Special) College', abbreviation: 'ASC' }])
    expect(abbr('Team A+ (Special) College here')).toBe('Team ASC here')
  })
})

describe('deptAcronym', () => {
  it('takes initials of the significant words', () => {
    expect(deptAcronym('College of Arts and Sciences')).toBe('CAS')
    expect(deptAcronym('College of Informatics and Computing Sciences')).toBe('CICS')
    expect(deptAcronym('College of Accountancy, Business, Economics, and International Hospitality Management')).toBe('CABEIHM')
  })
})

describe('shortDeptLabel', () => {
  const abbr = makeAbbreviator([{ name: 'College of Engineering', abbreviation: 'CoE' }])

  it('prefers a registered abbreviation', () => {
    expect(shortDeptLabel(abbr, 'College of Engineering')).toBe('CoE')
  })

  it('falls back to an acronym when the name is long and unabbreviated', () => {
    expect(shortDeptLabel(abbr, 'College of Nursing and Allied Health Sciences')).toBe('CNAHS')
  })

  it('leaves an already-short name alone', () => {
    expect(shortDeptLabel(abbr, 'CET')).toBe('CET')
  })

  it('is safe on empty input', () => {
    expect(shortDeptLabel(abbr, null)).toBe('')
  })
})
