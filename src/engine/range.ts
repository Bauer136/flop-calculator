import { type Card, cardSet } from './cards.ts'
import {
  CLASS_COMBOS,
  COMBO_CARDS,
  type ComboIndex,
  type HandClass,
  NUM_CLASSES,
  NUM_COMBOS,
  comboConflicts,
} from './combos.ts'

/**
 * Weight (0..1) per combo. Board and dead-card conflicts are applied as a mask
 * at analysis time and never written into a stored range.
 */
export type Range = Float32Array

export const createRange = (): Range => new Float32Array(NUM_COMBOS)

export function fullRange(): Range {
  return new Float32Array(NUM_COMBOS).fill(1)
}

export const cloneRange = (range: Range): Range => new Float32Array(range)

export function setClassWeight(range: Range, cls: HandClass, weight: number): void {
  for (const i of CLASS_COMBOS[cls]!) range[i] = weight
}

export function setComboWeight(range: Range, combo: ComboIndex, weight: number): void {
  range[combo] = weight
}

/** Sum of weights (= weighted combo count). */
export function comboCount(range: Range): number {
  let sum = 0
  for (let i = 0; i < NUM_COMBOS; i++) sum += range[i]!
  return sum
}

/** 1 for combos that don't touch any of `cards`, else 0. */
export function liveMask(cards: readonly Card[]): Uint8Array {
  const used = cardSet(cards)
  const mask = new Uint8Array(NUM_COMBOS)
  for (let i = 0; i < NUM_COMBOS; i++) mask[i] = comboConflicts(i, used) ? 0 : 1
  return mask
}

/** Copy of `range` with combos that use any of `cards` set to 0. */
export function removeCards(range: Range, cards: readonly Card[]): Range {
  const out = new Float32Array(range)
  if (cards.length === 0) return out
  const used = cardSet(cards)
  for (let i = 0; i < NUM_COMBOS; i++) {
    if (used[COMBO_CARDS[i * 2]!] || used[COMBO_CARDS[i * 2 + 1]!]) out[i] = 0
  }
  return out
}

/** Average weight of a class's combos, counting only those not blocked by `blocked`. */
export function classWeight(range: Range, cls: HandClass, blocked?: Uint8Array): number {
  let sum = 0
  let n = 0
  for (const i of CLASS_COMBOS[cls]!) {
    if (blocked && comboConflicts(i, blocked)) continue
    sum += range[i]!
    n++
  }
  return n === 0 ? 0 : sum / n
}

/** Weighted combo count of one class, skipping combos blocked by `blocked`. */
export function classComboCount(range: Range, cls: HandClass, blocked?: Uint8Array): number {
  let sum = 0
  for (const i of CLASS_COMBOS[cls]!) {
    if (blocked && comboConflicts(i, blocked)) continue
    sum += range[i]!
  }
  return sum
}

export function rangeUnion(a: Range, b: Range): Range {
  const out = createRange()
  for (let i = 0; i < NUM_COMBOS; i++) out[i] = Math.max(a[i]!, b[i]!)
  return out
}

export function rangeIntersect(a: Range, b: Range): Range {
  const out = createRange()
  for (let i = 0; i < NUM_COMBOS; i++) out[i] = Math.min(a[i]!, b[i]!)
  return out
}

/** a minus b, clamped at 0. */
export function rangeSubtract(a: Range, b: Range): Range {
  const out = createRange()
  for (let i = 0; i < NUM_COMBOS; i++) out[i] = Math.max(0, a[i]! - b[i]!)
  return out
}

export function rangesEqual(a: Range, b: Range, epsilon = 1e-6): boolean {
  for (let i = 0; i < NUM_COMBOS; i++) if (Math.abs(a[i]! - b[i]!) > epsilon) return false
  return true
}

export function isEmptyRange(range: Range): boolean {
  for (let i = 0; i < NUM_COMBOS; i++) if (range[i]! > 0) return false
  return true
}

/**
 * True when every combo in a class has the same weight, which makes the range
 * invariant under suit permutations (enables flop-isomorphism shortcuts).
 */
export function isSuitSymmetric(range: Range): boolean {
  for (let cls = 0; cls < NUM_CLASSES; cls++) {
    const combos = CLASS_COMBOS[cls]!
    const w = range[combos[0]!]!
    for (const i of combos) if (range[i] !== w) return false
  }
  return true
}
