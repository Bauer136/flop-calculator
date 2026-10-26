import { type Card, cardSet } from '../cards.ts'
import { COMBO_CARDS, NUM_COMBOS } from '../combos.ts'
import { addCardToMasks, boardMasks, evaluateWithBoard } from '../evaluator/evaluate.ts'
import { type EquityOptions, type EquityResult, NoMatchupsError } from './types.ts'

const KEY_SHIFT = 2048

/** Per-side scratch state for one runout. */
interface Side {
  weights: Float32Array
  /** Live combo indices (weight > 0, clear of board and dead cards). */
  live: Int16Array
  keys: Float64Array
  /** Total weight and per-card weight of this side's combos on the current runout. */
  total: number
  perCard: Float64Array
  num: Float64Array
  den: Float64Array
}

function makeSide(weights: Float32Array, used: Uint8Array): Side {
  const live: number[] = []
  for (let i = 0; i < NUM_COMBOS; i++) {
    if (weights[i]! <= 0) continue
    if (used[COMBO_CARDS[i * 2]!] || used[COMBO_CARDS[i * 2 + 1]!]) continue
    live.push(i)
  }
  return {
    weights,
    live: Int16Array.from(live),
    keys: new Float64Array(live.length),
    total: 0,
    perCard: new Float64Array(52),
    num: new Float64Array(NUM_COMBOS),
    den: new Float64Array(NUM_COMBOS),
  }
}

/** Scores a side's live combos on a full board; returns how many keys were written (sorted ascending). */
function scoreSide(side: Side, masks: Int32Array, runout: Uint8Array): number {
  let n = 0
  side.total = 0
  side.perCard.fill(0)
  for (let k = 0; k < side.live.length; k++) {
    const i = side.live[k]!
    const a = COMBO_CARDS[i * 2]!
    const b = COMBO_CARDS[i * 2 + 1]!
    if (runout[a] || runout[b]) continue
    const w = side.weights[i]!
    side.total += w
    side.perCard[a]! += w
    side.perCard[b]! += w
    side.keys[n++] = evaluateWithBoard(masks, a, b) * KEY_SHIFT + i
  }
  side.keys.subarray(0, n).sort()
  return n
}

/**
 * Accumulates win/tie weight for every combo of `a` against `b` on one runout.
 * Card removal is handled by inclusion–exclusion on per-card running sums, so the
 * cost is linear after sorting.
 */
function sweep(a: Side, nA: number, b: Side, nB: number, scratch: Scratch): void {
  const { belowCard, eqCard, passed, inEq } = scratch
  let belowTotal = 0
  let j = 0
  let i = 0
  while (i < nA) {
    const s = Math.floor(a.keys[i]! / KEY_SHIFT)
    let groupEnd = i + 1
    while (groupEnd < nA && Math.floor(a.keys[groupEnd]! / KEY_SHIFT) === s) groupEnd++

    while (j < nB) {
      const key = b.keys[j]!
      if (Math.floor(key / KEY_SHIFT) >= s) break
      const c = key % KEY_SHIFT
      const w = b.weights[c]!
      belowTotal += w
      belowCard[COMBO_CARDS[c * 2]!]! += w
      belowCard[COMBO_CARDS[c * 2 + 1]!]! += w
      passed[c] = 1
      j++
    }

    let eqTotal = 0
    let eqEnd = j
    while (eqEnd < nB) {
      const key = b.keys[eqEnd]!
      if (Math.floor(key / KEY_SHIFT) !== s) break
      const c = key % KEY_SHIFT
      const w = b.weights[c]!
      eqTotal += w
      eqCard[COMBO_CARDS[c * 2]!]! += w
      eqCard[COMBO_CARDS[c * 2 + 1]!]! += w
      inEq[c] = 1
      eqEnd++
    }

    for (let k = i; k < groupEnd; k++) {
      const h = a.keys[k]! % KEY_SHIFT
      const c1 = COMBO_CARDS[h * 2]!
      const c2 = COMBO_CARDS[h * 2 + 1]!
      const self = b.weights[h]!
      const win = belowTotal - belowCard[c1]! - belowCard[c2]! + (passed[h] ? self : 0)
      const tie = eqTotal - eqCard[c1]! - eqCard[c2]! + (inEq[h] ? self : 0)
      // A live combo of `a` is also live for `b` whenever b holds it, so `self` re-adds the
      // combo subtracted twice through its two cards.
      const total = b.total - b.perCard[c1]! - b.perCard[c2]! + self
      a.num[h]! += win + tie / 2
      a.den[h]! += total
    }

    for (let k = j; k < eqEnd; k++) {
      const c = b.keys[k]! % KEY_SHIFT
      eqCard[COMBO_CARDS[c * 2]!] = 0
      eqCard[COMBO_CARDS[c * 2 + 1]!] = 0
      inEq[c] = 0
    }
    i = groupEnd
  }
  for (let k = 0; k < j; k++) passed[b.keys[k]! % KEY_SHIFT] = 0
  belowCard.fill(0)
}

interface Scratch {
  belowCard: Float64Array
  eqCard: Float64Array
  passed: Uint8Array
  inEq: Uint8Array
}

/** Every way to complete `board` to five cards from `unseen`, as arrays of added cards. */
export function* runouts(unseen: readonly Card[], need: number): Generator<Card[]> {
  if (need === 0) {
    yield []
    return
  }
  if (need === 1) {
    for (const c of unseen) yield [c]
    return
  }
  if (need === 2) {
    for (let x = 0; x < unseen.length; x++) {
      for (let y = x + 1; y < unseen.length; y++) yield [unseen[x]!, unseen[y]!]
    }
    return
  }
  throw new Error('exactHeadsUp needs a flop, turn or river')
}

const choose2 = (n: number) => (n * (n - 1)) / 2

/**
 * Exact heads-up equity of `hero` vs `villain` on a 3–5 card board, enumerating every
 * turn/river runout. Per-combo equities are produced for both players.
 */
export function exactHeadsUp(
  hero: Float32Array,
  villain: Float32Array,
  board: readonly Card[],
  dead: readonly Card[] = [],
  opts: EquityOptions = {},
): EquityResult {
  if (board.length < 3 || board.length > 5) throw new Error('exactHeadsUp needs 3–5 board cards')
  const used = cardSet([...board, ...dead])
  const unseen: Card[] = []
  for (let c = 0; c < 52; c++) if (!used[c]) unseen.push(c)
  const need = 5 - board.length
  const totalRunouts = need === 0 ? 1 : need === 1 ? unseen.length : choose2(unseen.length)

  const h = makeSide(hero, used)
  const v = makeSide(villain, used)
  const scratch: Scratch = {
    belowCard: new Float64Array(52),
    eqCard: new Float64Array(52),
    passed: new Uint8Array(NUM_COMBOS),
    inEq: new Uint8Array(NUM_COMBOS),
  }
  const baseMasks = boardMasks(board)
  const masks = new Int32Array(8)
  const runout = new Uint8Array(52)

  let done = 0
  const progressEvery = Math.max(1, Math.floor(totalRunouts / 20))
  for (const extra of runouts(unseen, need)) {
    masks.set(baseMasks)
    for (const c of extra) {
      addCardToMasks(masks, c)
      runout[c] = 1
    }
    const nH = scoreSide(h, masks, runout)
    const nV = scoreSide(v, masks, runout)
    sweep(h, nH, v, nV, scratch)
    sweep(v, nV, h, nH, scratch)
    for (const c of extra) runout[c] = 0
    done++
    if (done % progressEvery === 0) {
      if (opts.onProgress)
        opts.onProgress({ fraction: done / totalRunouts, partial: buildResult(h, v, true) })
      if (opts.shouldStop?.()) break
    }
  }
  const result = buildResult(h, v, true)
  if (Number.isNaN(result.players[0]!)) throw new NoMatchupsError()
  return result
}

function buildResult(h: Side, v: Side, exact: boolean): EquityResult {
  const sides = [h, v]
  const comboEquity = sides.map(() => new Float32Array(NUM_COMBOS).fill(NaN))
  const comboWeight = sides.map(() => new Float32Array(NUM_COMBOS))
  const players = sides.map((side, p) => {
    let num = 0
    let den = 0
    for (const i of side.live) {
      const d = side.den[i]!
      if (d <= 0) continue
      const w = side.weights[i]!
      comboEquity[p]![i] = side.num[i]! / d
      comboWeight[p]![i] = w * d
      num += w * side.num[i]!
      den += w * d
    }
    return den > 0 ? num / den : NaN
  })
  return { players, comboEquity, comboWeight, exact }
}
