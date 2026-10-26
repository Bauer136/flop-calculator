import { NUM_COMBOS } from '../combos.ts'
import { type Condition, type ConditionContext, compileCondition } from './conditions.ts'

/** A colored bucket. Groups are exclusive: a combo belongs to the first group it matches. */
export interface Group {
  id: string
  name: string
  color: string
  condition: Condition
}

export interface GroupAssignment {
  /** Group index per combo, -1 when ungrouped or not live. */
  groupOf: Int8Array
  /** Weighted combos per group. */
  totals: number[]
  ungrouped: number
  total: number
}

export function assignGroups(
  weights: Float32Array,
  classes: Int32Array,
  groups: readonly Group[],
  ctx: ConditionContext = {},
): GroupAssignment {
  const tests = groups.map((g) => compileCondition(g.condition, ctx))
  const groupOf = new Int8Array(NUM_COMBOS).fill(-1)
  const totals = new Array<number>(groups.length).fill(0)
  let ungrouped = 0
  let total = 0
  for (let i = 0; i < NUM_COMBOS; i++) {
    const w = weights[i]!
    const p = classes[i]!
    if (w <= 0 || p < 0) continue
    total += w
    const g = tests.findIndex((t) => t(p, i))
    if (g < 0) {
      ungrouped += w
    } else {
      groupOf[i] = g
      totals[g]! += w
    }
  }
  return { groupOf, totals, ungrouped, total }
}
