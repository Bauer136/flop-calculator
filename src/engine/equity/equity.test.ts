import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { parseCards } from '../cards.ts'
import { COMBO_CARDS, NUM_COMBOS, combosOverlap } from '../combos.ts'
import { evaluate } from '../evaluator/evaluate.ts'
import { createRange } from '../range.ts'
import { parseRangeStrict } from '../rangeParser.ts'
import { chooseMethod, computeEquity } from './equity.ts'
import { exactThreeWay } from './exactMultiway.ts'
import { exactHeadsUp, runouts } from './exactHU.ts'
import { monteCarloEquity } from './monteCarlo.ts'
import { createRng } from './rng.ts'
import { NoMatchupsError } from './types.ts'

/** O(n² · runouts) reference: hero per-combo equity and total. */
function bruteForce(hero: Float32Array, villain: Float32Array, board: number[]) {
  const used = new Set(board)
  const unseen = [...Array(52).keys()].filter((c) => !used.has(c))
  const num = new Float64Array(NUM_COMBOS)
  const den = new Float64Array(NUM_COMBOS)
  for (const extra of runouts(unseen, 5 - board.length)) {
    const full = [...board, ...extra]
    const fullSet = new Set(full)
    const live = (i: number) =>
      !fullSet.has(COMBO_CARDS[i * 2]!) && !fullSet.has(COMBO_CARDS[i * 2 + 1]!)
    for (let h = 0; h < NUM_COMBOS; h++) {
      if (hero[h]! <= 0 || !live(h)) continue
      const hv = evaluate([...full, COMBO_CARDS[h * 2]!, COMBO_CARDS[h * 2 + 1]!])
      for (let v = 0; v < NUM_COMBOS; v++) {
        if (villain[v]! <= 0 || !live(v) || combosOverlap(h, v)) continue
        const vv = evaluate([...full, COMBO_CARDS[v * 2]!, COMBO_CARDS[v * 2 + 1]!])
        const w = villain[v]!
        num[h]! += hv > vv ? w : hv === vv ? w / 2 : 0
        den[h]! += w
      }
    }
  }
  let n = 0
  let d = 0
  for (let h = 0; h < NUM_COMBOS; h++) {
    if (den[h]! > 0) {
      n += hero[h]! * num[h]!
      d += hero[h]! * den[h]!
    }
  }
  return { total: n / d, num, den }
}

function randomRange(
  rng: ReturnType<typeof createRng>,
  size: number,
  board: number[],
): Float32Array {
  const r = createRange()
  const used = new Set(board)
  while (true) {
    const i = rng.int(NUM_COMBOS)
    if (used.has(COMBO_CARDS[i * 2]!) || used.has(COMBO_CARDS[i * 2 + 1]!)) continue
    r[i] = [1, 0.5, 0.25][rng.int(3)]!
    if (--size === 0) return r
  }
}

function randomBoard(rng: ReturnType<typeof createRng>, n: number): number[] {
  const s = new Set<number>()
  while (s.size < n) s.add(rng.int(52))
  return [...s]
}

describe('exactHeadsUp', () => {
  it('matches brute force on random small ranges (river, turn, flop)', () => {
    const rng = createRng(7)
    for (let t = 0; t < 200; t++) {
      const boardLen = t < 120 ? 5 : t < 180 ? 4 : 3
      const board = randomBoard(rng, boardLen)
      const size = boardLen === 3 ? 4 : 8
      const hero = randomRange(rng, size, board)
      const villain = randomRange(rng, size, board)
      let ref: ReturnType<typeof bruteForce>
      try {
        ref = bruteForce(hero, villain, board)
      } catch {
        continue
      }
      if (Number.isNaN(ref.total)) {
        expect(() => exactHeadsUp(hero, villain, board)).toThrow(NoMatchupsError)
        continue
      }
      const res = exactHeadsUp(hero, villain, board)
      expect(Math.abs(res.players[0]! - ref.total)).toBeLessThan(1e-9)
      expect(Math.abs(res.players[0]! + res.players[1]! - 1)).toBeLessThan(1e-9)
      for (let h = 0; h < NUM_COMBOS; h++) {
        if (ref.den[h]! > 0)
          expect(Math.abs(res.comboEquity[0]![h]! - ref.num[h]! / ref.den[h]!)).toBeLessThan(1e-6)
      }
    }
  })

  it('handles full ranges on a flop', () => {
    const r = parseRangeStrict('random')
    const res = exactHeadsUp(r, r, parseCards('Ks7d2c'))
    expect(res.players[0]).toBeCloseTo(0.5, 9)
  })
})

describe('monteCarloEquity', () => {
  it('lands within 3σ of exact', () => {
    const rng = createRng(11)
    for (let t = 0; t < 10; t++) {
      const board = randomBoard(rng, 3)
      const hero = randomRange(rng, 30, board)
      const villain = randomRange(rng, 30, board)
      const exact = exactHeadsUp(hero, villain, board).players[0]!
      const mc = monteCarloEquity([hero, villain], board, [], { seed: t + 1, maxTrials: 100_000 })
      expect(Math.abs(mc.players[0]! - exact)).toBeLessThan(3 * mc.stdError! + 1e-4)
    }
  })

  it('is deterministic for a seed', () => {
    const ranges = [parseRangeStrict('QQ+,AK'), parseRangeStrict('22+,A2s+')]
    const a = monteCarloEquity(ranges, [], [], { seed: 42, maxTrials: 20_000 })
    const b = monteCarloEquity(ranges, [], [], { seed: 42, maxTrials: 20_000 })
    expect(a.players).toEqual(b.players)
  })

  it('reproduces well-known preflop matchups', () => {
    const akoVsQQ = monteCarloEquity([parseRangeStrict('AKo'), parseRangeStrict('QQ')], [], [], {
      seed: 3,
      maxTrials: 600_000,
    })
    expect(Math.abs(akoVsQQ.players[0]! - 0.43)).toBeLessThan(0.005)
  })

  it('supports bunching (folded ranges) and multiway pots', () => {
    const res = monteCarloEquity(
      [parseRangeStrict('AA'), parseRangeStrict('KK'), parseRangeStrict('QQ')],
      [],
      [],
      { seed: 5, maxTrials: 50_000, foldedRanges: [parseRangeStrict('random')] },
    )
    expect(res.players.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9)
    expect(res.players[0]!).toBeGreaterThan(res.players[1]!)
  })
})

describe('computeEquity', () => {
  it('uses exact enumeration for fixed hands preflop', () => {
    // AA vs KK averages 81.95 %; with no shared suits the kings keep all their flush equity.
    const req = {
      ranges: [parseRangeStrict('AhAs'), parseRangeStrict('KdKc')],
      board: [],
      dead: [],
    }
    expect(chooseMethod(req)).toBe('exact-fixed')
    const res = computeEquity(req)
    expect(res.exact).toBe(true)
    expect(Math.abs(res.players[0]! - 0.8126)).toBeLessThan(0.0001)
    const shared = computeEquity({
      ...req,
      ranges: [parseRangeStrict('AhAs'), parseRangeStrict('KhKs')],
    })
    expect(Math.abs(shared.players[0]! - 0.8264)).toBeLessThan(0.0001)
  })

  it('picks exact heads-up postflop and Monte Carlo preflop for ranges', () => {
    const ranges = [parseRangeStrict('QQ+'), parseRangeStrict('22+')]
    expect(chooseMethod({ ranges, board: parseCards('Ks7d2c'), dead: [] })).toBe('exact-hu')
    expect(chooseMethod({ ranges, board: [], dead: [] })).toBe('monte-carlo')
  })

  it('exact 3-way agrees with Monte Carlo', () => {
    const ranges = [parseRangeStrict('AK'), parseRangeStrict('QQ,JJ'), parseRangeStrict('T9s,87s')]
    const board = parseCards('Ks9s5d2h')
    expect(chooseMethod({ ranges, board, dead: [] })).toBe('exact-3way')
    const exact = exactThreeWay(ranges, board)
    expect(exact.players.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9)
    const mc = monteCarloEquity(ranges, board, [], { seed: 9, maxTrials: 200_000 })
    for (let p = 0; p < 3; p++)
      expect(Math.abs(mc.players[p]! - exact.players[p]!)).toBeLessThan(0.01)
  })

  it('reports ranges that can never be dealt together', () => {
    expect(() =>
      computeEquity({
        ranges: [parseRangeStrict('AhAs'), parseRangeStrict('AhKh')],
        board: [],
        dead: [],
      }),
    ).toThrow(NoMatchupsError)
  })
})

describe('rng', () => {
  it('produces uniform-looking floats', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const rng = createRng(seed)
        let sum = 0
        for (let i = 0; i < 2000; i++) {
          const x = rng.float()
          expect(x).toBeGreaterThanOrEqual(0)
          expect(x).toBeLessThan(1)
          sum += x
        }
        expect(Math.abs(sum / 2000 - 0.5)).toBeLessThan(0.05)
      }),
      { numRuns: 20 },
    )
  })
})
