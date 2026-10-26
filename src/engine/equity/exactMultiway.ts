import { type Card, cardSet } from '../cards.ts'
import { COMBO_CARDS, NUM_COMBOS } from '../combos.ts'
import { addCardToMasks, boardMasks, evaluateWithBoard } from '../evaluator/evaluate.ts'
import { runouts } from './exactHU.ts'
import { type EquityOptions, type EquityResult, NoMatchupsError } from './types.ts'

interface Scored {
  combo: number
  a: number
  b: number
  w: number
  v: number
}

/**
 * Exact three-way equity by enumerating every runout and every non-colliding triple
 * of combos. Cost is O(n1 · n2 · n3) per runout, so callers keep it to modest ranges.
 */
export function exactThreeWay(
  ranges: Float32Array[],
  board: readonly Card[],
  dead: readonly Card[] = [],
  opts: EquityOptions = {},
): EquityResult {
  if (ranges.length !== 3) throw new Error('exactThreeWay needs exactly three ranges')
  if (board.length < 3) throw new Error('exactThreeWay needs a flop, turn or river')
  const used = cardSet([...board, ...dead])
  const unseen: Card[] = []
  for (let c = 0; c < 52; c++) if (!used[c]) unseen.push(c)
  const need = 5 - board.length
  const live = ranges.map((r) => {
    const out: number[] = []
    for (let i = 0; i < NUM_COMBOS; i++) {
      if (r[i]! > 0 && !used[COMBO_CARDS[i * 2]!] && !used[COMBO_CARDS[i * 2 + 1]!]) out.push(i)
    }
    return out
  })

  const num = ranges.map(() => new Float64Array(NUM_COMBOS))
  const den = ranges.map(() => new Float64Array(NUM_COMBOS))
  const totalShare = [0, 0, 0]
  let totalW = 0
  const baseMasks = boardMasks(board)
  const masks = new Int32Array(8)
  const runout = new Uint8Array(52)
  const allRunouts = [...runouts(unseen, need)]
  const progressEvery = Math.max(1, Math.floor(allRunouts.length / 20))

  for (let r = 0; r < allRunouts.length; r++) {
    const extra = allRunouts[r]!
    masks.set(baseMasks)
    for (const c of extra) {
      addCardToMasks(masks, c)
      runout[c] = 1
    }
    const scored: Scored[][] = live.map((list, p) =>
      list
        .filter((i) => !runout[COMBO_CARDS[i * 2]!] && !runout[COMBO_CARDS[i * 2 + 1]!])
        .map((i) => {
          const a = COMBO_CARDS[i * 2]!
          const b = COMBO_CARDS[i * 2 + 1]!
          return { combo: i, a, b, w: ranges[p]![i]!, v: evaluateWithBoard(masks, a, b) }
        }),
    )
    for (const c of extra) runout[c] = 0

    const [l0, l1, l2] = scored as [Scored[], Scored[], Scored[]]
    for (const x of l0) {
      for (const y of l1) {
        if (y.a === x.a || y.a === x.b || y.b === x.a || y.b === x.b) continue
        const wxy = x.w * y.w
        for (const z of l2) {
          if (z.a === x.a || z.a === x.b || z.b === x.a || z.b === x.b) continue
          if (z.a === y.a || z.a === y.b || z.b === y.a || z.b === y.b) continue
          const w = wxy * z.w
          const best = Math.max(x.v, y.v, z.v)
          const winners = (x.v === best ? 1 : 0) + (y.v === best ? 1 : 0) + (z.v === best ? 1 : 0)
          const sx = x.v === best ? 1 / winners : 0
          const sy = y.v === best ? 1 / winners : 0
          const sz = z.v === best ? 1 / winners : 0
          totalW += w
          totalShare[0]! += w * sx
          totalShare[1]! += w * sy
          totalShare[2]! += w * sz
          // Per-combo accumulators are weighted by the opponents' weights only.
          num[0]![x.combo]! += y.w * z.w * sx
          den[0]![x.combo]! += y.w * z.w
          num[1]![y.combo]! += x.w * z.w * sy
          den[1]![y.combo]! += x.w * z.w
          num[2]![z.combo]! += x.w * y.w * sz
          den[2]![z.combo]! += x.w * y.w
        }
      }
    }

    if ((r + 1) % progressEvery === 0) {
      opts.onProgress?.({ fraction: (r + 1) / allRunouts.length, partial: build() })
      if (opts.shouldStop?.()) break
    }
  }

  function build(): EquityResult {
    return {
      players: totalShare.map((s) => (totalW > 0 ? s / totalW : NaN)),
      comboEquity: num.map((n, p) => {
        const out = new Float32Array(NUM_COMBOS).fill(NaN)
        for (let i = 0; i < NUM_COMBOS; i++) if (den[p]![i]! > 0) out[i] = n[i]! / den[p]![i]!
        return out
      }),
      comboWeight: den.map((d, p) => {
        const out = new Float32Array(NUM_COMBOS)
        for (let i = 0; i < NUM_COMBOS; i++) out[i] = d[i]! * ranges[p]![i]!
        return out
      }),
      exact: true,
    }
  }

  if (totalW === 0) throw new NoMatchupsError()
  return build()
}
