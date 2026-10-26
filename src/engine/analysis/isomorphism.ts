import type { Card } from '../cards.ts'

export interface WeightedFlop {
  cards: [Card, Card, Card]
  /** How many of the 22,100 flops map to this one. */
  weight: number
}

/** All 24 permutations of the four suits. */
const SUIT_PERMS: number[][] = (() => {
  const out: number[][] = []
  const permute = (rest: number[], acc: number[]) => {
    if (rest.length === 0) out.push(acc)
    rest.forEach((s, i) => permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, s]))
  }
  permute([0, 1, 2, 3], [])
  return out
})()

const flopKey = (a: Card, b: Card, c: Card): number => {
  // Sort descending, then pack.
  if (a < b) [a, b] = [b, a]
  if (b < c) [b, c] = [c, b]
  if (a < b) [a, b] = [b, a]
  return (a * 52 + b) * 52 + c
}

let cachedAll: WeightedFlop[] | null = null
let cachedCanonical: WeightedFlop[] | null = null

/** All 22,100 flops with weight 1. */
export function allFlops(): WeightedFlop[] {
  if (cachedAll) return cachedAll
  const out: WeightedFlop[] = []
  for (let a = 2; a < 52; a++) {
    for (let b = 1; b < a; b++)
      for (let c = 0; c < b; c++) out.push({ cards: [a, b, c], weight: 1 })
  }
  cachedAll = out
  return out
}

/**
 * The 1,755 strategically distinct flops: each flop is mapped to the smallest key over
 * all suit relabelings, and weights count how many flops share a canonical form.
 * Valid only for analyses that are invariant under suit permutation.
 */
export function canonicalFlops(): WeightedFlop[] {
  if (cachedCanonical) return cachedCanonical
  const groups = new Map<number, WeightedFlop>()
  for (const { cards } of allFlops()) {
    let best = Infinity
    let bestCards: [Card, Card, Card] = cards
    for (const perm of SUIT_PERMS) {
      const m = cards.map((c) => (c & ~3) | perm[c & 3]!) as [Card, Card, Card]
      const key = flopKey(m[0], m[1], m[2])
      if (key < best) {
        best = key
        bestCards = m
      }
    }
    const g = groups.get(best)
    if (g) g.weight++
    else groups.set(best, { cards: bestCards, weight: 1 })
  }
  cachedCanonical = [...groups.values()]
  return cachedCanonical
}
