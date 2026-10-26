import { type Card, cardSet } from '../cards.ts'
import { boardInfo, classify } from '../categorize/classify.ts'
import { COMBO_CARDS, NUM_COMBOS } from '../combos.ts'
import type { ConditionContext } from './conditions.ts'
import { statDescriptors } from './stats.ts'

export interface NextCardRow {
  card: Card
  /** Weighted combos still live after this card. */
  total: number
  /** Weighted combos per stat, aligned with `statIds`. */
  counts: number[]
}

export interface NextCardResult {
  statIds: string[]
  rows: NextCardRow[]
}

/**
 * For every card that can come next (turn on a flop, river on a turn), tallies the
 * stats of `weights` on the extended board.
 */
export function nextCardStats(
  weights: Float32Array,
  board: readonly Card[],
  dead: readonly Card[] = [],
  ctx: ConditionContext = {},
): NextCardResult {
  if (board.length < 3 || board.length > 4) throw new Error('Next-card stats need a flop or turn')
  const descriptors = statDescriptors(ctx)
  const used = cardSet([...board, ...dead])
  const rows: NextCardRow[] = []
  for (let card = 0; card < 52; card++) {
    if (used[card]) continue
    const info = boardInfo([...board, card])
    const counts = new Array<number>(descriptors.length).fill(0)
    let total = 0
    for (let i = 0; i < NUM_COMBOS; i++) {
      const w = weights[i]!
      if (w <= 0) continue
      const a = COMBO_CARDS[i * 2]!
      const b = COMBO_CARDS[i * 2 + 1]!
      if (a === card || b === card || used[a] || used[b]) continue
      const p = classify(a, b, info)
      total += w
      for (let k = 0; k < descriptors.length; k++) if (descriptors[k]!.test(p, i)) counts[k]! += w
    }
    rows.push({ card, total, counts })
  }
  return { statIds: descriptors.map((d) => d.id), rows }
}
