import type { Card } from '../cards.ts'
import { POPCOUNT, STRAIGHT_HIGH, TOP_RANK, topRanks } from './tables.ts'

/**
 * Hand strength: category << 20 | five 4-bit rank nibbles (most significant first).
 * Higher is better; equal values tie. Unused nibbles are zero, so every one of the
 * 7,462 five-card equivalence classes has exactly one value.
 */
export type HandValue = number

export const HIGH_CARD = 0
export const PAIR = 1
export const TWO_PAIR = 2
export const TRIPS = 3
export const STRAIGHT = 4
export const FLUSH = 5
export const FULL_HOUSE = 6
export const QUADS = 7
export const STRAIGHT_FLUSH = 8

export const CATEGORY_NAMES = [
  'High card',
  'Pair',
  'Two pair',
  'Trips',
  'Straight',
  'Flush',
  'Full house',
  'Quads',
  'Straight flush',
] as const

export const categoryOf = (value: HandValue): number => value >>> 20

/**
 * Scores a hand of 5–7 cards given per-suit rank masks (s0..s3) and
 * "count ≥ k" rank masks (m1..m4).
 */
export function scoreMasks(
  s0: number,
  s1: number,
  s2: number,
  s3: number,
  m1: number,
  m2: number,
  m3: number,
  m4: number,
): HandValue {
  // A flush can't coexist with quads or a full house in ≤ 7 cards, so it is checked first.
  const fm =
    POPCOUNT[s0]! >= 5
      ? s0
      : POPCOUNT[s1]! >= 5
        ? s1
        : POPCOUNT[s2]! >= 5
          ? s2
          : POPCOUNT[s3]! >= 5
            ? s3
            : 0
  if (fm !== 0) {
    const sf = STRAIGHT_HIGH[fm]!
    if (sf >= 0) return (STRAIGHT_FLUSH << 20) | (sf << 16)
    return (FLUSH << 20) | topRanks(fm, 5)
  }
  if (m4 !== 0) {
    const q = TOP_RANK[m4]!
    return (QUADS << 20) | (q << 16) | (TOP_RANK[m1 & ~(1 << q)]! << 12)
  }
  if (m3 !== 0) {
    const t = TOP_RANK[m3]!
    const rest = m2 & ~(1 << t)
    if (rest !== 0) return (FULL_HOUSE << 20) | (t << 16) | (TOP_RANK[rest]! << 12)
  }
  const st = STRAIGHT_HIGH[m1]!
  if (st >= 0) return (STRAIGHT << 20) | (st << 16)
  if (m3 !== 0) {
    const t = TOP_RANK[m3]!
    return (TRIPS << 20) | (t << 16) | (topRanks(m1 & ~(1 << t), 2) << 8)
  }
  if (m2 !== 0) {
    const p1 = TOP_RANK[m2]!
    const rest = m2 & ~(1 << p1)
    if (rest !== 0) {
      const p2 = TOP_RANK[rest]!
      const k = TOP_RANK[m1 & ~(1 << p1) & ~(1 << p2)]!
      return (TWO_PAIR << 20) | (p1 << 16) | (p2 << 12) | (k << 8)
    }
    return (PAIR << 20) | (p1 << 16) | (topRanks(m1 & ~(1 << p1), 3) << 4)
  }
  return topRanks(m1, 5)
}

/** Evaluates the best 5-card hand among 5–7 cards. */
export function evaluate(cards: ArrayLike<Card>, count: number = cards.length): HandValue {
  let s0 = 0
  let s1 = 0
  let s2 = 0
  let s3 = 0
  let m1 = 0
  let m2 = 0
  let m3 = 0
  let m4 = 0
  for (let i = 0; i < count; i++) {
    const c = cards[i]!
    const b = 1 << (c >> 2)
    switch (c & 3) {
      case 0:
        s0 |= b
        break
      case 1:
        s1 |= b
        break
      case 2:
        s2 |= b
        break
      default:
        s3 |= b
    }
    if (m3 & b) m4 |= b
    else if (m2 & b) m3 |= b
    else if (m1 & b) m2 |= b
    else m1 |= b
  }
  return scoreMasks(s0, s1, s2, s3, m1, m2, m3, m4)
}

/**
 * Precomputed masks for a fixed board, so many hole-card pairs can be scored
 * against it cheaply: [s0, s1, s2, s3, m1, m2, m3, m4].
 */
export type BoardMasks = Int32Array

export function boardMasks(board: ArrayLike<Card>, count: number = board.length): BoardMasks {
  const st = new Int32Array(8)
  for (let i = 0; i < count; i++) addCardToMasks(st, board[i]!)
  return st
}

export function addCardToMasks(st: BoardMasks, c: Card): void {
  const b = 1 << (c >> 2)
  st[c & 3]! |= b
  if (st[6]! & b) st[7]! |= b
  else if (st[5]! & b) st[6]! |= b
  else if (st[4]! & b) st[5]! |= b
  else st[4]! |= b
}

/** Scores board + two hole cards (board must have 3–5 cards so the total is 5–7). */
export function evaluateWithBoard(st: BoardMasks, c1: Card, c2: Card): HandValue {
  let s0 = st[0]!
  let s1 = st[1]!
  let s2 = st[2]!
  let s3 = st[3]!
  let m1 = st[4]!
  let m2 = st[5]!
  let m3 = st[6]!
  let m4 = st[7]!

  let b = 1 << (c1 >> 2)
  let s = c1 & 3
  if (s === 0) s0 |= b
  else if (s === 1) s1 |= b
  else if (s === 2) s2 |= b
  else s3 |= b
  if (m3 & b) m4 |= b
  else if (m2 & b) m3 |= b
  else if (m1 & b) m2 |= b
  else m1 |= b

  b = 1 << (c2 >> 2)
  s = c2 & 3
  if (s === 0) s0 |= b
  else if (s === 1) s1 |= b
  else if (s === 2) s2 |= b
  else s3 |= b
  if (m3 & b) m4 |= b
  else if (m2 & b) m3 |= b
  else if (m1 & b) m2 |= b
  else m1 |= b

  return scoreMasks(s0, s1, s2, s3, m1, m2, m3, m4)
}

/** Human-readable description, e.g. "Full house". */
export function describeValue(value: HandValue): string {
  return CATEGORY_NAMES[categoryOf(value)]!
}
