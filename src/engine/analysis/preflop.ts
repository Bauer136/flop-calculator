import { type Card, cardSet } from '../cards.ts'
import { BUILTIN_STATS } from '../categorize/categories.ts'
import { boardInfo, classify } from '../categorize/classify.ts'
import { COMBO_CARDS, NUM_COMBOS } from '../combos.ts'
import { type Range, isSuitSymmetric } from '../range.ts'
import { allFlops, canonicalFlops } from './isomorphism.ts'
import { TEXTURE_BUCKETS, flopTexture, textureBucket } from './texture.ts'

export interface PreflopStatsResult {
  statIds: string[]
  /** Σ over flops of the range's live weight (the denominator for every probability). */
  total: number
  /** Live range weight per texture bucket: the flop breakdown weighted by card removal. */
  bucketWeight: Float64Array
  /** Raw number of flops per texture bucket (no card removal). */
  flopsPerBucket: Float64Array
  /** Weighted count per stat and bucket, flattened as [stat * TEXTURE_BUCKETS + bucket]. */
  statBucket: Float64Array
  flopsEvaluated: number
  usedIsomorphism: boolean
}

export interface PreflopOptions {
  onProgress?: (fraction: number) => void
  shouldStop?: () => boolean
}

/**
 * How a preflop range performs over every flop: for each built-in stat and flop texture,
 * the weighted number of (combo, flop) pairs. P(stat) = Σ_buckets statBucket / total.
 * Uses the 1,755 suit-isomorphic flops when the range is suit-symmetric and no cards are dead.
 */
export function preflopStats(
  range: Range,
  dead: readonly Card[] = [],
  opts: PreflopOptions = {},
): PreflopStatsResult {
  const useIso = dead.length === 0 && isSuitSymmetric(range)
  const flops = useIso ? canonicalFlops() : allFlops()
  const deadSet = cardSet(dead)
  const live: number[] = []
  for (let i = 0; i < NUM_COMBOS; i++) {
    if (range[i]! > 0 && !deadSet[COMBO_CARDS[i * 2]!] && !deadSet[COMBO_CARDS[i * 2 + 1]!])
      live.push(i)
  }

  const stats = BUILTIN_STATS
  const statBucket = new Float64Array(stats.length * TEXTURE_BUCKETS)
  // Stat membership is a pure function of the packed class, so cache it as two 32-bit masks.
  const known = new Uint8Array(1 << 17)
  const maskLo = new Int32Array(1 << 17)
  const maskHi = new Int32Array(1 << 17)
  const bucketWeight = new Float64Array(TEXTURE_BUCKETS)
  const flopsPerBucket = new Float64Array(TEXTURE_BUCKETS)
  let total = 0
  let evaluated = 0
  const progressEvery = Math.max(1, Math.floor(flops.length / 50))

  for (let f = 0; f < flops.length; f++) {
    const { cards, weight } = flops[f]!
    if (deadSet[cards[0]] || deadSet[cards[1]] || deadSet[cards[2]]) continue
    const bucket = textureBucket(flopTexture(cards))
    flopsPerBucket[bucket]! += weight
    const info = boardInfo(cards)
    for (const i of live) {
      const a = COMBO_CARDS[i * 2]!
      const b = COMBO_CARDS[i * 2 + 1]!
      if (
        a === cards[0] ||
        a === cards[1] ||
        a === cards[2] ||
        b === cards[0] ||
        b === cards[1] ||
        b === cards[2]
      )
        continue
      const w = range[i]! * weight
      const p = classify(a, b, info)
      if (!known[p]) {
        let lo = 0
        let hi = 0
        for (let k = 0; k < stats.length; k++) {
          if (!stats[k]!.test(p)) continue
          if (k < 32) lo |= 1 << k
          else hi |= 1 << (k - 32)
        }
        maskLo[p] = lo
        maskHi[p] = hi
        known[p] = 1
      }
      for (let m = maskLo[p]!; m !== 0; m &= m - 1) {
        statBucket[(31 - Math.clz32(m & -m)) * TEXTURE_BUCKETS + bucket]! += w
      }
      for (let m = maskHi[p]!; m !== 0; m &= m - 1) {
        statBucket[(63 - Math.clz32(m & -m)) * TEXTURE_BUCKETS + bucket]! += w
      }
      bucketWeight[bucket]! += w
      total += w
    }
    evaluated++
    if ((f + 1) % progressEvery === 0) {
      opts.onProgress?.((f + 1) / flops.length)
      if (opts.shouldStop?.()) break
    }
  }

  return {
    statIds: stats.map((s) => s.id),
    total,
    bucketWeight,
    flopsPerBucket,
    statBucket,
    flopsEvaluated: evaluated,
    usedIsomorphism: useIso,
  }
}
