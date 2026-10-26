/** Lookup tables over 13-bit rank masks (bit r set ⇔ rank r present). */

export const RANK_MASK_SIZE = 1 << 13

/** Highest set bit index, -1 for 0. */
export const TOP_RANK = new Int8Array(RANK_MASK_SIZE)
/** Number of set bits. */
export const POPCOUNT = new Uint8Array(RANK_MASK_SIZE)
/** Top rank of the best straight contained in the mask (wheel = 3), -1 if none. */
export const STRAIGHT_HIGH = new Int8Array(RANK_MASK_SIZE)

/** The ten straight windows, best first: { mask, high }. Wheel is A-2-3-4-5 with high 3. */
export const STRAIGHT_WINDOWS: readonly { mask: number; high: number }[] = (() => {
  const out: { mask: number; high: number }[] = []
  for (let high = 12; high >= 4; high--) out.push({ mask: 0b11111 << (high - 4), high })
  out.push({ mask: (1 << 12) | 0b1111, high: 3 })
  return out
})()

TOP_RANK[0] = -1
for (let m = 1; m < RANK_MASK_SIZE; m++) {
  TOP_RANK[m] = 31 - Math.clz32(m)
  POPCOUNT[m] = POPCOUNT[m >> 1]! + (m & 1)
}
for (let m = 0; m < RANK_MASK_SIZE; m++) {
  let high = -1
  for (const w of STRAIGHT_WINDOWS) {
    if ((m & w.mask) === w.mask) {
      high = w.high
      break
    }
  }
  STRAIGHT_HIGH[m] = high
}

/** The top `n` set bits of `mask` packed as 4-bit rank nibbles, highest first. */
export function topRanks(mask: number, n: number): number {
  let v = 0
  for (let k = 0; k < n; k++) {
    const t = TOP_RANK[mask]!
    v = (v << 4) | t
    mask &= ~(1 << t)
  }
  return v
}
