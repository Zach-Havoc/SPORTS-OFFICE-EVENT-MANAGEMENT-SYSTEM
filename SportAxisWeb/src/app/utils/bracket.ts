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

/**
 * Fisher–Yates (Durstenfeld) shuffle: every ordering of the teams is equally
 * likely. Returns a new array. `random` is injectable for tests.
 */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export type BracketFormat = 'single_elimination' | 'double_elimination' | 'round_robin'

/** How a bracket's format reads in the UI. */
export function formatLabel(format: string | null | undefined): string {
  if (format === 'round_robin') return 'Round Robin'
  if (format === 'double_elimination') return 'Double Elimination'
  return 'Single Elimination'
}

/**
 * Games a double elimination of `n` teams plays: every team but the champion
 * loses twice (2n-2 games), plus the grand-final reset when the lower-bracket
 * champion wins the grand final. `withReset` → the most it can take.
 */
export function doubleEliminationGames(n: number, withReset = true): number {
  if (n < 3) return 0
  return 2 * n - 2 + (withReset ? 1 : 0)
}

export type BracketSection = 'upper' | 'lower' | 'grand_final'

/**
 * Split a double elimination's matches into its parts, each as rounds in
 * play order. A match without a `section` (an older single elimination) is
 * upper. The upper matches are returned with links to other parts removed,
 * so they draw as a tree of their own.
 */
export function splitDoubleElimination<
  M extends { id: string; round: number; slot: number; section?: string | null; stageLabel: string; nextMatchId: string | null },
>(matches: M[]) {
  const sectionOf = (m: M): BracketSection => (m.section === 'lower' || m.section === 'grand_final' ? m.section : 'upper')
  const rounds = (section: BracketSection) => {
    const byRound = new Map<number, M[]>()
    for (const m of matches) {
      if (sectionOf(m) !== section) continue
      if (!byRound.has(m.round)) byRound.set(m.round, [])
      byRound.get(m.round)!.push(m)
    }
    return [...byRound.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([round, ms]) => ({ round, label: ms[0].stageLabel, matches: [...ms].sort((a, b) => a.slot - b.slot) }))
  }
  const upperIds = new Set(matches.filter((m) => sectionOf(m) === 'upper').map((m) => m.id))
  const upper = matches
    .filter((m) => sectionOf(m) === 'upper')
    .map((m) => ({ ...m, nextMatchId: m.nextMatchId && upperIds.has(m.nextMatchId) ? m.nextMatchId : null }))

  return { upper, lower: rounds('lower'), grandFinal: rounds('grand_final') }
}
