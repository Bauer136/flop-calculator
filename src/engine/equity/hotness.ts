import { type Card, cardSet } from '../cards.ts'
import { exactHeadsUp } from './exactHU.ts'
import { type EquityOptions, NoMatchupsError } from './types.ts'

export interface HotnessRow {
  card: Card
  /** Hero equity after this card (NaN when no matchups remain). */
  equity: number
  /** Change vs the current board's equity. */
  delta: number
}

export interface HotnessResult {
  baseEquity: number
  rows: HotnessRow[]
}

/**
 * For each possible next card (turn on a flop, river on a turn), the hero's exact
 * heads-up equity on the extended board and its change from the current equity.
 */
export function hotness(
  hero: Float32Array,
  villain: Float32Array,
  board: readonly Card[],
  dead: readonly Card[] = [],
  opts: EquityOptions = {},
): HotnessResult {
  if (board.length < 3 || board.length > 4) throw new Error('Hotness needs a flop or turn')
  const baseEquity = exactHeadsUp(hero, villain, board, dead).players[0]!
  const used = cardSet([...board, ...dead])
  const cards: Card[] = []
  for (let c = 0; c < 52; c++) if (!used[c]) cards.push(c)
  const rows: HotnessRow[] = []
  for (let k = 0; k < cards.length; k++) {
    const card = cards[k]!
    let equity = NaN
    try {
      equity = exactHeadsUp(hero, villain, [...board, card], dead).players[0]!
    } catch (e) {
      if (!(e instanceof NoMatchupsError)) throw e
    }
    rows.push({ card, equity, delta: equity - baseEquity })
    opts.onProgress?.({
      fraction: (k + 1) / cards.length,
      partial: {
        players: [baseEquity, 1 - baseEquity],
        comboEquity: [],
        comboWeight: [],
        exact: true,
      },
    })
    if (opts.shouldStop?.()) break
  }
  return { baseEquity, rows }
}
