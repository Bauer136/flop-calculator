import { describe, expect, it } from 'vitest'
import { parseCards } from '../cards.ts'
import { NUM_COMBOS } from '../combos.ts'
import { comboCount } from '../range.ts'
import { parseRangeStrict } from '../rangeParser.ts'
import { PREFLOP_ORDER, rangePercent, topPercentRange } from '../ranking.ts'
import { allFlops, canonicalFlops } from './isomorphism.ts'
import { type PreflopStatsResult, preflopStats } from './preflop.ts'
import { TEXTURE_BUCKETS, decodeBucket, flopTexture, textureBucket } from './texture.ts'

function statProbability(
  r: PreflopStatsResult,
  statId: string,
  where?: (b: ReturnType<typeof decodeBucket>) => boolean,
) {
  const s = r.statIds.indexOf(statId)
  let sum = 0
  for (let b = 0; b < TEXTURE_BUCKETS; b++) {
    if (!where || where(decodeBucket(b))) sum += r.statBucket[s * TEXTURE_BUCKETS + b]!
  }
  return sum / r.total
}

describe('flop isomorphism', () => {
  it('has 1,755 canonical flops weighing 22,100', () => {
    const flops = canonicalFlops()
    expect(flops).toHaveLength(1755)
    expect(flops.reduce((a, f) => a + f.weight, 0)).toBe(22100)
    expect(allFlops()).toHaveLength(22100)
  })
})

describe('flop texture', () => {
  it('classifies and round-trips buckets', () => {
    const t = flopTexture(parseCards('Ks7s7d'))
    expect(t).toEqual({ suitedness: 1, pairing: 1, high: 11, connected: 0 })
    expect(flopTexture(parseCards('9h8h7h')).connected).toBe(1)
    expect(flopTexture(parseCards('Ah5c2d')).connected).toBe(1)
    for (let b = 0; b < TEXTURE_BUCKETS; b++) expect(textureBucket(decodeBucket(b))).toBe(b)
  })
})

describe('preflopStats', () => {
  it('matches closed-form flop texture frequencies for the full range', () => {
    const r = preflopStats(parseRangeStrict('random'))
    expect(r.usedIsomorphism).toBe(true)
    const share = (pred: (b: ReturnType<typeof decodeBucket>) => boolean) => {
      let flops = 0
      for (let b = 0; b < TEXTURE_BUCKETS; b++)
        if (pred(decodeBucket(b))) flops += r.flopsPerBucket[b]!
      return flops / 22100
    }
    expect(share((t) => t.suitedness === 2)).toBeCloseTo((4 * 286) / 22100, 10) // 5.18 %
    expect(share((t) => t.pairing === 1)).toBeCloseTo(3744 / 22100, 10) // 16.94 %
  })

  it('reproduces "88 flops an overpair on a rainbow board 4.2857 %"', () => {
    const r = preflopStats(parseRangeStrict('88'))
    expect(statProbability(r, 'made.overpair', (t) => t.suitedness === 0)).toBeCloseTo(
      840 / 19600,
      10,
    )
  })

  it('gives identical results with and without isomorphism for symmetric ranges', () => {
    const range = parseRangeStrict('JJ,AKs,76s')
    const iso = preflopStats(range)
    expect(iso.usedIsomorphism).toBe(true)
    // A negligible extra weight on one combo makes the range asymmetric, forcing all 22,100 flops.
    const nudged = new Float32Array(range)
    nudged[0] = 1e-9
    const brute = preflopStats(nudged)
    expect(brute.usedIsomorphism).toBe(false)
    for (const id of ['made.set', 'made.overpair', 'made.flush', 'draw.flushDraw', 'draw.oesd']) {
      expect(statProbability(brute, id)).toBeCloseTo(statProbability(iso, id), 6)
    }
  })

  it('removes flops with dead cards', () => {
    const r = preflopStats(parseRangeStrict('AA'), parseCards('Ks'))
    expect(r.usedIsomorphism).toBe(false)
    expect(r.flopsEvaluated).toBe(22100 - 1275)
  })
})

describe('preflop ranking', () => {
  it('orders all 169 classes with AA first', () => {
    expect(new Set(PREFLOP_ORDER).size).toBe(169)
    expect(comboCount(topPercentRange(0.5))).toBe(6)
    expect(rangePercent(topPercentRange(100))).toBe(100)
    expect(comboCount(topPercentRange(0))).toBe(0)
    const ten = rangePercent(topPercentRange(10))
    expect(Math.abs(ten - 10)).toBeLessThan(1)
    expect(comboCount(topPercentRange(100))).toBe(NUM_COMBOS)
  })
})
