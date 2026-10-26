import type { Card } from '../cards.ts'
import { POPCOUNT, STRAIGHT_WINDOWS } from '../evaluator/tables.ts'

export const SUITEDNESS = ['Rainbow', 'Two-tone', 'Monotone'] as const
export const PAIRING = ['Unpaired', 'Paired', 'Trips'] as const
export const CONNECTIVITY = ['No straight possible', 'Straight possible'] as const

export interface FlopTexture {
  /** 0 rainbow, 1 two-tone, 2 monotone. */
  suitedness: number
  /** 0 unpaired, 1 paired, 2 trips. */
  pairing: number
  /** Highest rank (0 = 2 … 12 = A). */
  high: number
  /** 1 when some straight is possible with two hole cards. */
  connected: number
}

/** Number of distinct texture buckets (3 × 3 × 13 × 2). */
export const TEXTURE_BUCKETS = 234

export function flopTexture(flop: readonly Card[]): FlopTexture {
  const [a, b, c] = flop as [Card, Card, Card]
  const suits = new Set([a & 3, b & 3, c & 3]).size
  const ranks = (1 << (a >> 2)) | (1 << (b >> 2)) | (1 << (c >> 2))
  const distinct = POPCOUNT[ranks]!
  let connected = 0
  if (distinct === 3) {
    for (const w of STRAIGHT_WINDOWS) {
      if (POPCOUNT[ranks & w.mask]! === 3) {
        connected = 1
        break
      }
    }
  }
  return {
    suitedness: 3 - suits,
    pairing: 3 - distinct,
    high: Math.max(a >> 2, b >> 2, c >> 2),
    connected,
  }
}

export function textureBucket(t: FlopTexture): number {
  return ((t.suitedness * 3 + t.pairing) * 13 + t.high) * 2 + t.connected
}

export function decodeBucket(bucket: number): FlopTexture {
  const connected = bucket % 2
  const rest = (bucket - connected) / 2
  const high = rest % 13
  const sp = (rest - high) / 13
  return { suitedness: Math.floor(sp / 3), pairing: sp % 3, high, connected }
}
