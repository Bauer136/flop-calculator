import { type Card, cardSet } from '../cards.ts'
import { COMBO_CARDS, NUM_COMBOS } from '../combos.ts'
import { addCardToMasks, boardMasks, evaluateWithBoard } from '../evaluator/evaluate.ts'
import { type EquityOptions, type EquityResult, NoMatchupsError } from './types.ts'

/**
 * Exact equity for fixed hands (one combo per player, any number of players) by
 * enumerating every board completion. Preflop heads-up is C(48,5) = 1,712,304 boards.
 */
export function exactFixedHands(
  combos: readonly number[],
  board: readonly Card[],
  dead: readonly Card[] = [],
  opts: EquityOptions = {},
): EquityResult {
  const holeCards: Card[] = []
  for (const c of combos) holeCards.push(COMBO_CARDS[c * 2]!, COMBO_CARDS[c * 2 + 1]!)
  const all = [...board, ...dead, ...holeCards]
  if (new Set(all).size !== all.length) throw new NoMatchupsError()
  const used = cardSet(all)
  const deck: Card[] = []
  for (let c = 0; c < 52; c++) if (!used[c]) deck.push(c)
  const need = 5 - board.length

  const np = combos.length
  const share = new Float64Array(np)
  let boards = 0
  const levels = Array.from({ length: need + 1 }, () => new Int32Array(8))
  levels[0]!.set(boardMasks(board))
  const values = new Float64Array(np)
  let stopped = false

  const visit = (depth: number, start: number) => {
    if (stopped) return
    const masks = levels[depth]!
    if (depth === need) {
      let best = -1
      let winners = 0
      for (let p = 0; p < np; p++) {
        const v = evaluateWithBoard(masks, holeCards[p * 2]!, holeCards[p * 2 + 1]!)
        values[p] = v
        if (v > best) {
          best = v
          winners = 1
        } else if (v === best) winners++
      }
      for (let p = 0; p < np; p++) if (values[p] === best) share[p]! += 1 / winners
      boards++
      return
    }
    for (let k = start; k < deck.length; k++) {
      const next = levels[depth + 1]!
      next.set(masks)
      addCardToMasks(next, deck[k]!)
      visit(depth + 1, k + 1)
      if (depth === 0 && k % 4 === 0) {
        opts.onProgress?.({ fraction: k / deck.length, partial: build() })
        if (opts.shouldStop?.()) stopped = true
      }
    }
  }

  const build = (): EquityResult => {
    const players = Array.from(share, (s) => s / boards)
    const comboEquity = combos.map((c, p) => {
      const out = new Float32Array(NUM_COMBOS).fill(NaN)
      out[c] = players[p]!
      return out
    })
    const comboWeight = combos.map((c) => {
      const out = new Float32Array(NUM_COMBOS)
      out[c] = 1
      return out
    })
    return { players, comboEquity, comboWeight, exact: true }
  }

  visit(0, 0)
  return build()
}

/** The single combo a range holds, or -1 when it holds zero or several. */
export function singleCombo(range: Float32Array): number {
  let found = -1
  for (let i = 0; i < NUM_COMBOS; i++) {
    if (range[i]! <= 0) continue
    if (found >= 0) return -1
    found = i
  }
  return found
}
