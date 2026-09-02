/**
 * Bracket seeding helpers.
 *
 * When a bracket is "seeded from standings", teams must be placed so that the
 * top seed meets the bottom seed first, #1 and #2 can only meet in the final,
 * and byes go to the highest seeds.
 */

/** Smallest power of two >= n (min 2). */
export function nextPowerOfTwo(n: number): number {
  let p = 2
  while (p < n) p *= 2
  return p
}

/**
 * Standard single-elimination slot order for a bracket of `size` (a power of
 * two). Returns the SEED NUMBER that belongs in each slot, top to bottom.
 *
 *   size 4 -> [1, 4, 2, 3]
 *   size 8 -> [1, 8, 4, 5, 2, 7, 3, 6]
 */
export function seedSlots(size: number): number[] {
  if (size < 2 || (size & (size - 1)) !== 0) {
    throw new Error(`seedSlots: size must be a power of two >= 2, got ${size}`)
  }
  const rounds = Math.log2(size)
  let seeds = [1, 2]
  for (let r = 1; r < rounds; r++) {
    const sum = seeds.length * 2 + 1
    const next: number[] = []
    for (const s of seeds) next.push(s, sum - s)
    seeds = next
  }
  return seeds
}

/**
 * Given teams already ordered best-seed-first, return the round-1 slot list
 * (length = next power of two). Empty slots (byes) are `null` and fall to the
 * highest seeds.
 */
export function seededSlotOrder(teamsBySeed: string[]): (string | null)[] {
  const size = nextPowerOfTwo(teamsBySeed.length)
  return seedSlots(size).map((seedNo) => teamsBySeed[seedNo - 1] ?? null)
}
