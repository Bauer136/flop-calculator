import type { Card } from '../cards.ts'
import { COMBO_CARDS, type ComboIndex, NUM_COMBOS } from '../combos.ts'
import { evaluateWithBoard } from '../evaluator/evaluate.ts'
import type { Range } from '../range.ts'
import { type BoardInfo, boardInfo } from './boardInfo.ts'
import { classifyDraws } from './draws.ts'
import { classifyMade } from './madeHand.ts'

export { type BoardInfo, boardInfo }

/** Packed classification (see categories.ts) of hole cards c1, c2 on a 3–5 card board. */
export function classify(c1: Card, c2: Card, info: BoardInfo): number {
  const value = evaluateWithBoard(info.masks, c1, c2)
  const madeAndKicker = classifyMade(c1, c2, info, value)
  return madeAndKicker | (classifyDraws(c1, c2, info, madeAndKicker & 15) << 6)
}

export function classifyCombo(combo: ComboIndex, info: BoardInfo): number {
  return classify(COMBO_CARDS[combo * 2]!, COMBO_CARDS[combo * 2 + 1]!, info)
}

/**
 * Classifies every combo with weight > 0 that doesn't touch the board or `blocked`.
 * Returns packed classes per combo, -1 where the combo is dead or has zero weight.
 */
export function classifyRange(range: Range, info: BoardInfo, blocked?: Uint8Array): Int32Array {
  const out = new Int32Array(NUM_COMBOS).fill(-1)
  const used = new Uint8Array(52)
  for (const c of info.cards) used[c] = 1
  if (blocked) for (let c = 0; c < 52; c++) if (blocked[c]) used[c] = 1
  for (let i = 0; i < NUM_COMBOS; i++) {
    if (range[i]! <= 0) continue
    const a = COMBO_CARDS[i * 2]!
    const b = COMBO_CARDS[i * 2 + 1]!
    if (used[a] || used[b]) continue
    out[i] = classify(a, b, info)
  }
  return out
}
