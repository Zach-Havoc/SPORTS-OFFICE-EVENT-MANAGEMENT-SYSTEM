import { describe, it, expect } from 'vitest'
import { nextPowerOfTwo, seedSlots, seededSlotOrder, shuffle, formatLabel, doubleEliminationGames, splitDoubleElimination } from './bracket'

describe('nextPowerOfTwo', () => {
  it('rounds up to a power of two', () => {
    expect(nextPowerOfTwo(1)).toBe(2)
    expect(nextPowerOfTwo(2)).toBe(2)
    expect(nextPowerOfTwo(3)).toBe(4)
    expect(nextPowerOfTwo(5)).toBe(8)
    expect(nextPowerOfTwo(8)).toBe(8)
    expect(nextPowerOfTwo(9)).toBe(16)
  })
})

describe('seedSlots', () => {
  it('produces the standard slot order', () => {
    expect(seedSlots(2)).toEqual([1, 2])
    expect(seedSlots(4)).toEqual([1, 4, 2, 3])
    expect(seedSlots(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6])
  })

  it('keeps #1 and #2 in opposite halves', () => {
    const slots = seedSlots(8)
    const half = slots.length / 2
    const posOf1 = slots.indexOf(1)
    const posOf2 = slots.indexOf(2)
    expect(posOf1 < half).toBe(true)
    expect(posOf2 >= half).toBe(true)
  })

  it('pairs the top seed against the bottom seed in round 1', () => {
    const slots = seedSlots(8)
    expect(slots[0]).toBe(1)
    expect(slots[1]).toBe(8) // #1 vs #8
  })

  it('rejects non-power-of-two sizes', () => {
    expect(() => seedSlots(6)).toThrow()
    expect(() => seedSlots(0)).toThrow()
  })
})

describe('seededSlotOrder', () => {
  it('places teams by seed and gives byes (null) to the top seeds', () => {
    // 5 teams -> bracket of 8, seeds 6..8 are byes.
    const teams = ['A', 'B', 'C', 'D', 'E'] // A is #1 seed
    const order = seededSlotOrder(teams)

    expect(order).toHaveLength(8)
    // slot order for size 8 is [1,8,4,5,2,7,3,6]
    expect(order).toEqual([
      'A',   // seed 1
      null,  // seed 8 (bye)
      'D',   // seed 4
      'E',   // seed 5
      'B',   // seed 2
      null,  // seed 7 (bye)
      'C',   // seed 3
      null,  // seed 6 (bye)
    ])
    // The #1 seed's round-1 opponent is a bye.
    expect(order[1]).toBeNull()
  })

  it('is a clean 1v4 / 2v3 for four teams', () => {
    expect(seededSlotOrder(['A', 'B', 'C', 'D'])).toEqual(['A', 'D', 'B', 'C'])
  })
})

describe('shuffle', () => {
  it('keeps every team exactly once and leaves the input untouched', () => {
    const teams = ['A', 'B', 'C', 'D', 'E']
    const out = shuffle(teams)
    expect([...out].sort()).toEqual(teams)
    expect(teams).toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  it('makes every ordering about equally likely', () => {
    const counts = new Map<string, number>()
    const runs = 60000
    for (let k = 0; k < runs; k++) {
      const key = shuffle(['A', 'B', 'C']).join('')
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    expect(counts.size).toBe(6)
    for (const n of counts.values()) {
      expect(Math.abs(n - runs / 6)).toBeLessThan(runs / 6 * 0.1)
    }
  })
})

describe('formatLabel', () => {
  it('names each format', () => {
    expect(formatLabel('round_robin')).toBe('Round Robin')
    expect(formatLabel('double_elimination')).toBe('Double Elimination')
    expect(formatLabel('single_elimination')).toBe('Single Elimination')
    expect(formatLabel(undefined)).toBe('Single Elimination')
  })
})

describe('doubleEliminationGames', () => {
  it('is 2n-2, plus the reset', () => {
    expect(doubleEliminationGames(2)).toBe(0)
    expect(doubleEliminationGames(3)).toBe(5)
    expect(doubleEliminationGames(7)).toBe(13)
    expect(doubleEliminationGames(7, false)).toBe(12)
    expect(doubleEliminationGames(8, false)).toBe(14)
  })
})

describe('splitDoubleElimination', () => {
  const m = (id: string, section: string, round: number, slot: number, next: string | null) =>
    ({ id, section, round, slot, stageLabel: `${section} ${round}`, nextMatchId: next })

  it('separates the parts and cuts the upper tree loose from the grand final', () => {
    const { upper, lower, grandFinal } = splitDoubleElimination([
      m('u1', 'upper', 1, 0, 'u3'),
      m('u2', 'upper', 1, 1, 'u3'),
      m('l1', 'lower', 2, 0, 'l2'),
      m('u3', 'upper', 3, 0, 'g1'),
      m('l2', 'lower', 4, 0, 'g1'),
      m('g2', 'grand_final', 6, 0, null),
      m('g1', 'grand_final', 5, 0, 'g2'),
    ])
    expect(upper.map((x) => x.id)).toEqual(['u1', 'u2', 'u3'])
    expect(upper.find((x) => x.id === 'u3')!.nextMatchId).toBeNull()
    expect(upper.find((x) => x.id === 'u1')!.nextMatchId).toBe('u3')
    expect(lower.map((r) => r.matches.map((x) => x.id))).toEqual([['l1'], ['l2']])
    expect(grandFinal.map((r) => r.matches[0].id)).toEqual(['g1', 'g2'])
  })
})
