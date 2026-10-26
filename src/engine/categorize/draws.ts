import type { Card } from '../cards.ts'
import { POPCOUNT, STRAIGHT_HIGH, STRAIGHT_WINDOWS } from '../evaluator/tables.ts'
import type { BoardInfo } from './boardInfo.ts'
import { DRAW, MADE } from './categories.ts'

const WINDOW_MASKS = Int32Array.from(STRAIGHT_WINDOWS.map((w) => w.mask))

/** Draw flags for hole cards c1, c2 (flop and turn only; 0 on the river). */
export function classifyDraws(c1: Card, c2: Card, info: BoardInfo, made: number): number {
  if (info.n >= 5) return 0
  let draws = 0
  const r1 = c1 >> 2
  const r2 = c2 >> 2
  const s1 = c1 & 3
  const s2 = c2 & 3

  // Flush draws: exactly four of a suit including a hole card (five would be a flush).
  let backdoor = 0
  for (let k = 0; k < 2; k++) {
    const s = k === 0 ? s1 : s2
    if (k === 1 && s2 === s1) break
    const holeOfSuit = (s1 === s ? 1 : 0) + (s2 === s ? 1 : 0)
    const total = info.suitCount[s]! + holeOfSuit
    if (total === 4) {
      draws |= DRAW.FlushDraw | (holeOfSuit === 2 ? DRAW.FlushDraw2Card : DRAW.FlushDraw1Card)
      const nut = info.nutRank[s]!
      if ((s1 === s && r1 === nut) || (s2 === s && r2 === nut)) draws |= DRAW.NutFlushDraw
    } else if (total === 3 && info.n === 3) {
      backdoor |=
        DRAW.BackdoorFlushDraw |
        (holeOfSuit === 2 ? DRAW.BackdoorFlushDraw2Card : DRAW.BackdoorFlushDraw1Card)
    }
  }
  if (!(draws & DRAW.FlushDraw)) draws |= backdoor

  const key = r1 * 13 + r2
  let straight = info.straightDrawCache[key]!
  if (straight < 0) {
    straight = straightDraws(r1, r2, info)
    info.straightDrawCache[key] = straight
  }
  draws |= straight

  if ((made === MADE.AceHigh || made === MADE.NoMadeHand) && Math.min(r1, r2) > info.distinct[0]!) {
    draws |= DRAW.Overcards
  }
  return draws
}

/** Straight-draw flags for hole ranks r1, r2 (they don't depend on suits). */
function straightDraws(r1: number, r2: number, info: BoardInfo): number {
  // Outs are ranks that complete a straight the board alone can't match.
  const m = info.rankMask | (1 << r1) | (1 << r2)
  const holeOnly = ((1 << r1) | (1 << r2)) & ~info.rankMask
  if (STRAIGHT_HIGH[m]! >= 0 || holeOnly === 0) return 0
  let outs = 0
  let twoAway = false
  for (let i = 0; i < WINDOW_MASKS.length; i++) {
    const w = WINDOW_MASKS[i]!
    if ((w & holeOnly) === 0) continue
    const missing = w & ~m
    const pc = POPCOUNT[missing]!
    if (pc === 1) outs |= missing
    else if (pc === 2) twoAway = true
  }
  let outCount = 0
  for (let r = 0; r < 13; r++) {
    if (outs & (1 << r) && STRAIGHT_HIGH[m | (1 << r)]! > info.straightWithRank[r]!) outCount++
  }
  if (outCount >= 2) return DRAW.OESD
  if (outCount === 1) return DRAW.Gutshot
  if (twoAway && info.n === 3) return DRAW.BackdoorStraightDraw
  return 0
}
