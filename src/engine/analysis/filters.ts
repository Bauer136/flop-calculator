import { NUM_COMBOS } from '../combos.ts'
import { type Condition, type ConditionContext, compileCondition } from './conditions.ts'

export interface FilterStep {
  id: string
  condition: Condition
  /**
   * keep:   matching combos are multiplied by `weight`, the rest are dropped.
   * remove: matching combos are multiplied by (1 − weight), the rest are untouched.
   */
  mode: 'keep' | 'remove'
  /** 0..1; 1 = full filter. */
  weight: number
  /** Apply the step to combos that do NOT match. */
  inverted: boolean
}

/** Applies filter steps in order and returns new weights. */
export function applyFilters(
  weights: Float32Array,
  classes: Int32Array,
  steps: readonly FilterStep[],
  ctx: ConditionContext = {},
): Float32Array {
  const out = new Float32Array(weights)
  for (const step of steps) {
    const test = compileCondition(step.condition, ctx)
    for (let i = 0; i < NUM_COMBOS; i++) {
      const w = out[i]!
      if (w <= 0) continue
      const p = classes[i]!
      if (p < 0) continue
      const match = test(p, i) !== step.inverted
      if (step.mode === 'keep') out[i] = match ? w * step.weight : 0
      else if (match) out[i] = w * (1 - step.weight)
    }
  }
  return out
}
