import type { Card } from '../cards.ts'
import { type BoardInfo, boardInfo, classifyRange } from '../categorize/classify.ts'
import { BUILTIN_STATS, type StatId } from '../categorize/categories.ts'
import { NUM_COMBOS } from '../combos.ts'
import { type Range, removeCards } from '../range.ts'
import {
  type ConditionContext,
  type ComboTest,
  compileCondition,
  customStatId,
} from './conditions.ts'

export interface StatRow {
  id: StatId
  label: string
  section: 'made' | 'draws' | 'custom'
  depth: 0 | 1
  /** Weighted combo count. */
  combos: number
  /** Share of the range total, 0..100. */
  percent: number
}

export interface StatsResult {
  /** Weighted combo count of the live range on this board. */
  total: number
  rows: StatRow[]
  /** Packed classification per combo, -1 for dead / zero-weight combos. */
  classes: Int32Array
  /** Effective weights (board and dead cards removed). */
  weights: Float32Array
}

export interface StatDescriptor {
  id: StatId
  label: string
  section: StatRow['section']
  depth: 0 | 1
  test: ComboTest
}

/** Built-in stats followed by custom stats, compiled for this context. */
export function statDescriptors(ctx: ConditionContext = {}): StatDescriptor[] {
  const out: StatDescriptor[] = BUILTIN_STATS.map((s) => ({
    id: s.id,
    label: s.label,
    section: s.section,
    depth: s.depth,
    test: (packed: number) => s.test(packed),
  }))
  for (const custom of ctx.customStats ?? []) {
    const id = customStatId(custom.id)
    out.push({
      id,
      label: custom.name,
      section: 'custom',
      depth: 0,
      test: compileCondition({ type: 'stat', stat: id }, ctx),
    })
  }
  return out
}

/** Stats of `weights` (already masked for board/dead cards) given packed classes. */
export function tallyStats(
  weights: Float32Array,
  classes: Int32Array,
  descriptors: readonly StatDescriptor[],
): { total: number; rows: StatRow[] } {
  const sums = new Float64Array(descriptors.length)
  let total = 0
  for (let i = 0; i < NUM_COMBOS; i++) {
    const w = weights[i]!
    const p = classes[i]!
    if (w <= 0 || p < 0) continue
    total += w
    for (let k = 0; k < descriptors.length; k++) if (descriptors[k]!.test(p, i)) sums[k]! += w
  }
  const rows = descriptors.map((d, k) => ({
    id: d.id,
    label: d.label,
    section: d.section,
    depth: d.depth,
    combos: sums[k]!,
    percent: total > 0 ? (sums[k]! / total) * 100 : 0,
  }))
  return { total, rows }
}

/** Classifies `range` on `board` and tallies every built-in and custom stat. */
export function computeStats(
  range: Range,
  board: readonly Card[],
  dead: readonly Card[] = [],
  ctx: ConditionContext = {},
  info: BoardInfo = boardInfo(board),
): StatsResult {
  const weights = removeCards(range, [...board, ...dead])
  const classes = classifyRange(weights, info)
  const { total, rows } = tallyStats(weights, classes, statDescriptors(ctx))
  return { total, rows, classes, weights }
}
