import type { Card } from '../cards.ts'
import { type BoardMasks, boardMasks, evaluate } from '../evaluator/evaluate.ts'
import { STRAIGHT_HIGH } from '../evaluator/tables.ts'
import { KICKER } from './categories.ts'

/** Everything about a board that classification needs, computed once per board. */
export interface BoardInfo {
  cards: readonly Card[]
  /** Number of board cards (3–5). */
  n: number
  rankCount: Uint8Array
  suitCount: Uint8Array
  /** Rank mask of board cards per suit. */
  suitMask: Int32Array
  /** Ranks present on the board. */
  rankMask: number
  /** Distinct board ranks, high → low (D in the docs). */
  distinct: number[]
  /** Index of a rank in `distinct`, -1 when not on the board. */
  rankIndex: Int8Array
  masks: BoardMasks
  /** Evaluator value of the board alone (river only), else -1. */
  boardValue: number
  /** STRAIGHT_HIGH of board ranks plus rank r. */
  straightWithRank: Int8Array
  /** Top-pair kicker class by kicker rank. */
  kickerClass: Uint8Array
  /** Highest rank of each suit that is not on the board (-1 if all are). */
  nutRank: Int8Array
  /** Straight-draw flags by hole ranks (r1 * 13 + r2), -1 until computed; they depend only on ranks. */
  straightDrawCache: Int16Array
}

export function boardInfo(cards: readonly Card[]): BoardInfo {
  const n = cards.length
  if (n < 3 || n > 5) throw new Error('Board must have 3 to 5 cards')
  const rankCount = new Uint8Array(13)
  const suitCount = new Uint8Array(4)
  const suitMask = new Int32Array(4)
  let rankMask = 0
  for (const c of cards) {
    rankCount[c >> 2]!++
    suitCount[c & 3]!++
    suitMask[c & 3]! |= 1 << (c >> 2)
    rankMask |= 1 << (c >> 2)
  }
  const distinct: number[] = []
  const rankIndex = new Int8Array(13).fill(-1)
  for (let r = 12; r >= 0; r--) {
    if (rankCount[r]) {
      rankIndex[r] = distinct.length
      distinct.push(r)
    }
  }
  const straightWithRank = new Int8Array(13)
  for (let r = 0; r < 13; r++) straightWithRank[r] = STRAIGHT_HIGH[rankMask | (1 << r)]!

  // Kicker classes: available ranks (not on board), high → low: first = top, next two = good.
  const kickerClass = new Uint8Array(13).fill(KICKER.Weak)
  let seen = 0
  for (let r = 12; r >= 0; r--) {
    if (rankCount[r]) continue
    kickerClass[r] = seen === 0 ? KICKER.Top : seen <= 2 ? KICKER.Good : KICKER.Weak
    seen++
  }

  const nutRank = new Int8Array(4).fill(-1)
  for (let s = 0; s < 4; s++) {
    for (let r = 12; r >= 0; r--) {
      if (!(suitMask[s]! & (1 << r))) {
        nutRank[s] = r
        break
      }
    }
  }

  return {
    cards,
    n,
    rankCount,
    suitCount,
    suitMask,
    rankMask,
    distinct,
    rankIndex,
    masks: boardMasks(cards),
    boardValue: n === 5 ? evaluate(cards) : -1,
    straightWithRank,
    kickerClass,
    nutRank,
    straightDrawCache: new Int16Array(169).fill(-1),
  }
}
