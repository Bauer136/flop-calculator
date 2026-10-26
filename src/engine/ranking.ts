import { CLASS_COMBOS, NUM_COMBOS, type HandClass, classOfRanks } from './combos.ts'
import { parseRank } from './cards.ts'
import { type Range, createRange, setClassWeight } from './range.ts'
import ranking from './data/preflopRanking.json' with { type: 'json' }

/** Hand classes ordered best → worst by equity vs a random hand. */
export const PREFLOP_ORDER: readonly HandClass[] = ranking.order.map((name) => {
  const hi = parseRank(name.charAt(0))
  const lo = parseRank(name.charAt(1))
  return classOfRanks(hi, lo, name.charAt(2) === 's')
})

export const PREFLOP_EQUITY: Readonly<Record<string, number>> = ranking.equity

/**
 * The top `percent` (0..100) of all 1,326 combos, filled class by class in ranking
 * order. A class is included when at least half of it fits under the target.
 */
export function topPercentRange(percent: number): Range {
  const target = (Math.max(0, Math.min(100, percent)) / 100) * NUM_COMBOS
  const range = createRange()
  let count = 0
  for (const cls of PREFLOP_ORDER) {
    const n = CLASS_COMBOS[cls]!.length
    if (count + n / 2 > target) break
    setClassWeight(range, cls, 1)
    count += n
  }
  return range
}

/** Weighted share of all combos, 0..100. */
export function rangePercent(range: Range): number {
  let sum = 0
  for (let i = 0; i < NUM_COMBOS; i++) sum += range[i]!
  return (sum / NUM_COMBOS) * 100
}
