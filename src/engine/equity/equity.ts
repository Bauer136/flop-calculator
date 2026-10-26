import type { Card } from '../cards.ts'
import { removeCards } from '../range.ts'
import { exactHeadsUp } from './exactHU.ts'
import { exactFixedHands, singleCombo } from './handVsHand.ts'
import { type MonteCarloOptions, monteCarloEquity } from './monteCarlo.ts'
import { exactThreeWay } from './exactMultiway.ts'
import type { EquityResult } from './types.ts'

export interface EquityRequest {
  /** One range per player; index 0 is the hero. */
  ranges: Float32Array[]
  board: Card[]
  dead: Card[]
  /** Force Monte Carlo even when an exact method applies. */
  monteCarlo?: boolean
  seed?: number
  maxTrials?: number
  targetStdError?: number
  /** Bunching: fold ranges of players who folded before the action (Monte Carlo only). */
  foldedRanges?: Float32Array[]
}

export type EquityMethod = 'exact-hu' | 'exact-fixed' | 'exact-3way' | 'monte-carlo'

/** Live combos of a range after board/dead removal, capped at `limit + 1` for cheap checks. */
function liveCount(range: Float32Array, limit: number): number {
  let n = 0
  for (let i = 0; i < range.length; i++) if (range[i]! > 0 && ++n > limit) break
  return n
}

/** Picks the cheapest exact method that applies, else Monte Carlo. */
export function chooseMethod(req: EquityRequest): EquityMethod {
  if (req.monteCarlo || (req.foldedRanges?.length ?? 0) > 0) return 'monte-carlo'
  const blocked = [...req.board, ...req.dead]
  const live = req.ranges.map((r) => removeCards(r, blocked))
  const fixed = live.every((r) => singleCombo(r) >= 0)
  const n = req.ranges.length
  if (fixed && (req.board.length >= 3 || n <= 4)) return 'exact-fixed'
  if (req.board.length >= 3 && n === 2) return 'exact-hu'
  if (req.board.length >= 3 && n === 3) {
    // Exact 3-way is O(n1·n2·n3) per runout: keep it to ranges where that stays interactive.
    const product = live.reduce((acc, r) => acc * liveCount(r, 1326), 1)
    const runouts = [1081, 46, 1][req.board.length - 3]!
    if (product * runouts <= 1.5e8) return 'exact-3way'
  }
  return 'monte-carlo'
}

export function computeEquity(
  req: EquityRequest,
  opts: Pick<MonteCarloOptions, 'onProgress' | 'shouldStop'> = {},
): EquityResult & { method: EquityMethod } {
  const method = chooseMethod(req)
  const blocked = [...req.board, ...req.dead]
  switch (method) {
    case 'exact-fixed': {
      const combos = req.ranges.map((r) => singleCombo(removeCards(r, blocked)))
      return { ...exactFixedHands(combos, req.board, req.dead, opts), method }
    }
    case 'exact-hu':
      return { ...exactHeadsUp(req.ranges[0]!, req.ranges[1]!, req.board, req.dead, opts), method }
    case 'exact-3way':
      return { ...exactThreeWay(req.ranges, req.board, req.dead, opts), method }
    case 'monte-carlo':
      return {
        ...monteCarloEquity(req.ranges, req.board, req.dead, {
          ...opts,
          seed: req.seed,
          maxTrials: req.maxTrials,
          targetStdError: req.targetStdError ?? 0.001,
          foldedRanges: req.foldedRanges,
        }),
        method,
      }
  }
}
