import { type Card, cardSet } from '../cards.ts'
import { COMBO_CARDS, NUM_COMBOS } from '../combos.ts'
import { addCardToMasks, boardMasks, evaluateWithBoard } from '../evaluator/evaluate.ts'
import { type Rng, createRng } from './rng.ts'
import { type EquityOptions, type EquityResult, NoMatchupsError } from './types.ts'

export interface MonteCarloOptions extends EquityOptions {
  seed?: number
  maxTrials?: number
  /** Stop once the hero's standard error is at or below this (after `minTrials`). */
  targetStdError?: number
  minTrials?: number
  /** Trials between progress reports / stop checks. */
  batchSize?: number
  /**
   * Bunching effect: ranges of players who folded before the action. Their hands
   * are dealt (and removed from the deck) on every trial but don't play.
   */
  foldedRanges?: Float32Array[]
}

/** Walker alias table for O(1) weighted sampling of a range's live combos. */
interface AliasTable {
  combos: Int16Array
  prob: Float64Array
  alias: Int32Array
}

function aliasTable(weights: Float32Array, used: Uint8Array): AliasTable {
  const combos: number[] = []
  const ws: number[] = []
  for (let i = 0; i < NUM_COMBOS; i++) {
    const w = weights[i]!
    if (w <= 0 || used[COMBO_CARDS[i * 2]!] || used[COMBO_CARDS[i * 2 + 1]!]) continue
    combos.push(i)
    ws.push(w)
  }
  const n = combos.length
  if (n === 0) throw new NoMatchupsError()
  const sum = ws.reduce((a, b) => a + b, 0)
  const prob = new Float64Array(n)
  const alias = new Int32Array(n)
  const scaled = ws.map((w) => (w * n) / sum)
  const small: number[] = []
  const large: number[] = []
  scaled.forEach((p, i) => (p < 1 ? small : large).push(i))
  while (small.length && large.length) {
    const s = small.pop()!
    const l = large.pop()!
    prob[s] = scaled[s]!
    alias[s] = l
    scaled[l] = scaled[l]! + scaled[s]! - 1
    ;(scaled[l]! < 1 ? small : large).push(l)
  }
  for (const i of [...small, ...large]) prob[i] = 1
  return { combos: Int16Array.from(combos), prob, alias }
}

function sample(t: AliasTable, rng: Rng): number {
  const k = rng.int(t.combos.length)
  return t.combos[rng.float() < t.prob[k]! ? k : t.alias[k]!]!
}

/**
 * Monte Carlo equity for 2+ players. Each trial draws every player's combo by weight,
 * rejects trials where hands collide, completes the board and splits ties.
 */
export function monteCarloEquity(
  ranges: Float32Array[],
  board: readonly Card[],
  dead: readonly Card[] = [],
  opts: MonteCarloOptions = {},
): EquityResult {
  const maxTrials = opts.maxTrials ?? 2_000_000
  const minTrials = opts.minTrials ?? 20_000
  const target = opts.targetStdError ?? 0
  const batch = opts.batchSize ?? 20_000
  const rng = createRng(opts.seed ?? 1)
  const used = cardSet([...board, ...dead])
  const tables = ranges.map((r) => aliasTable(r, used))
  const foldTables = (opts.foldedRanges ?? []).map((r) => aliasTable(r, used))
  const deck: Card[] = []
  for (let c = 0; c < 52; c++) if (!used[c]) deck.push(c)
  const need = 5 - board.length
  const baseMasks = boardMasks(board)
  const masks = new Int32Array(8)

  const np = ranges.length
  const share = new Float64Array(np)
  const comboShare = ranges.map(() => new Float64Array(NUM_COMBOS))
  const comboTrials = ranges.map(() => new Float64Array(NUM_COMBOS))
  let heroSq = 0
  const stamp = new Int32Array(52)
  let stampId = 0
  const hands = new Int32Array(np)
  const values = new Float64Array(np)

  let trials = 0
  let attempts = 0
  const maxAttempts = maxTrials * 50

  const result = (): EquityResult => {
    const comboEquity = comboShare.map((s, p) => {
      const out = new Float32Array(NUM_COMBOS).fill(NaN)
      for (let i = 0; i < NUM_COMBOS; i++) {
        const t = comboTrials[p]![i]!
        if (t > 0) out[i] = s[i]! / t
      }
      return out
    })
    const comboWeight = comboTrials.map((t) => Float32Array.from(t))
    const heroMean = trials > 0 ? share[0]! / trials : NaN
    const variance = trials > 1 ? Math.max(0, heroSq / trials - heroMean * heroMean) : NaN
    return {
      players: Array.from(share, (s) => (trials > 0 ? s / trials : NaN)),
      comboEquity,
      comboWeight,
      exact: false,
      trials,
      stdError: trials > 1 ? Math.sqrt(variance / trials) : NaN,
    }
  }

  outer: while (trials < maxTrials) {
    const batchEnd = Math.min(maxTrials, trials + batch)
    while (trials < batchEnd) {
      if (++attempts > maxAttempts) break outer
      stampId++
      let ok = true
      for (const t of foldTables) {
        const c = sample(t, rng)
        const a = COMBO_CARDS[c * 2]!
        const b = COMBO_CARDS[c * 2 + 1]!
        if (stamp[a] === stampId || stamp[b] === stampId) {
          ok = false
          break
        }
        stamp[a] = stampId
        stamp[b] = stampId
      }
      if (!ok) continue
      for (let p = 0; p < np; p++) {
        const c = sample(tables[p]!, rng)
        const a = COMBO_CARDS[c * 2]!
        const b = COMBO_CARDS[c * 2 + 1]!
        if (stamp[a] === stampId || stamp[b] === stampId) {
          ok = false
          break
        }
        stamp[a] = stampId
        stamp[b] = stampId
        hands[p] = c
      }
      if (!ok) continue

      masks.set(baseMasks)
      for (let k = 0; k < need; k++) {
        let card: Card
        do card = deck[rng.int(deck.length)]!
        while (stamp[card] === stampId)
        stamp[card] = stampId
        addCardToMasks(masks, card)
      }

      let best = -1
      let winners = 0
      for (let p = 0; p < np; p++) {
        const c = hands[p]!
        const v = evaluateWithBoard(masks, COMBO_CARDS[c * 2]!, COMBO_CARDS[c * 2 + 1]!)
        values[p] = v
        if (v > best) {
          best = v
          winners = 1
        } else if (v === best) {
          winners++
        }
      }
      for (let p = 0; p < np; p++) {
        const s = values[p] === best ? 1 / winners : 0
        share[p]! += s
        comboShare[p]![hands[p]!]! += s
        comboTrials[p]![hands[p]!]! += 1
        if (p === 0) heroSq += s * s
      }
      trials++
    }

    const partial = result()
    opts.onProgress?.({ fraction: trials / maxTrials, partial })
    if (opts.shouldStop?.()) break
    if (target > 0 && trials >= minTrials && partial.stdError! <= target) break
  }

  if (trials === 0) throw new NoMatchupsError()
  return result()
}
