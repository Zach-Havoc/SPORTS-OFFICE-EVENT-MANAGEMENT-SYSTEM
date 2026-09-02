import { describe, it, expect } from 'vitest'
import { nextPowerOfTwo, seedSlots, seededSlotOrder } from './bracket'

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
