import { test } from 'vitest'
import { boardMasks, evaluate, evaluateWithBoard } from './evaluate.ts'

const N = 100_000
const hands: Uint8Array[] = []
let seed = 12345
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed
}
for (let i = 0; i < N; i++) {
  const used = new Set<number>()
  while (used.size < 7) used.add(rand() % 52)
  hands.push(Uint8Array.from(used))
}

test('evaluator, 100k hands per iteration (target ≥ 10M evals/s → ≤ 10 ms)', async ({ bench }) => {
  await bench.compare(
    bench('evaluate (7 cards)', () => {
      for (let i = 0; i < N; i++) evaluate(hands[i]!, 7)
    }),
    bench('evaluateWithBoard (5 board + 2)', () => {
      for (let i = 0; i < N; i += 100) {
        const masks = boardMasks(hands[i]!, 5)
        for (let j = i; j < i + 100; j++) {
          const h = hands[j]!
          evaluateWithBoard(masks, h[5]!, h[6]!)
        }
      }
    }),
  )
})
