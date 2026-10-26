import type { Card } from '../cards.ts'
import {
  FLUSH,
  FULL_HOUSE,
  QUADS,
  STRAIGHT,
  STRAIGHT_FLUSH,
  type HandValue,
} from '../evaluator/evaluate.ts'
import type { BoardInfo } from './boardInfo.ts'
import { MADE } from './categories.ts'

const MADE_BY_CATEGORY: Record<number, number> = {
  [STRAIGHT_FLUSH]: MADE.StraightFlush,
  [QUADS]: MADE.Quads,
  [FULL_HOUSE]: MADE.FullHouse,
  [FLUSH]: MADE.Flush,
  [STRAIGHT]: MADE.Straight,
}

/**
 * Made-hand id and top-pair kicker class for hole cards c1, c2 on `info`'s board,
 * given the evaluator value of hole + board. Returns made | kicker << 4.
 */
export function classifyMade(c1: Card, c2: Card, info: BoardInfo, value: HandValue): number {
  const category = value >>> 20

  // Rules 1–5: big hands count only when a hole card is needed for them.
  if (category >= STRAIGHT) {
    let credited: boolean
    if (category === QUADS) {
      const q = (value >> 16) & 15
      credited = c1 >> 2 === q || c2 >> 2 === q
    } else {
      credited = info.n < 5 || value > info.boardValue
    }
    if (credited) return MADE_BY_CATEGORY[category]!
  }

  // Rule 6: on the river, neither hole card plays.
  if (info.n === 5 && value === info.boardValue) return MADE.BoardPlays

  const r1 = c1 >> 2
  const r2 = c2 >> 2
  const { rankCount, distinct } = info
  const top = distinct[0]!

  if (r1 === r2) {
    if (rankCount[r1]! >= 1) return MADE.Set
    if (r1 > top) return MADE.Overpair
    if (distinct.length === 1 || r1 > distinct[1]!) return MADE.PPBelowTopPair
    return MADE.WeakPair
  }

  const b1 = rankCount[r1]!
  const b2 = rankCount[r2]!
  if (b1 >= 2 || b2 >= 2) return MADE.Trips
  if (b1 === 1 && b2 === 1) return MADE.TwoPair
  if (b1 === 1 || b2 === 1) {
    const paired = b1 === 1 ? r1 : r2
    const idx = info.rankIndex[paired]!
    if (idx === 0) {
      const kicker = paired === r1 ? r2 : r1
      return MADE.TopPair | (info.kickerClass[kicker]! << 4)
    }
    if (idx === 1 && distinct.length >= 3) return MADE.MiddlePair
    return MADE.WeakPair
  }
  return r1 === 12 || r2 === 12 ? MADE.AceHigh : MADE.NoMadeHand
}
