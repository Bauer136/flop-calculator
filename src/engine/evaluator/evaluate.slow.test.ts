import { expect, it } from 'vitest'
import { categoryOf, scoreMasks } from './evaluate.ts'

/** Adds card c to the masks in `from`, writing the result into `to`. */
function addInto(from: Int32Array, to: Int32Array, c: number): void {
  to.set(from)
  const b = 1 << (c >> 2)
  to[c & 3]! |= b
  if (to[6]! & b) to[7]! |= b
  else if (to[5]! & b) to[6]! |= b
  else if (to[4]! & b) to[5]! |= b
  else to[4]! |= b
}

it('matches the exhaustive 7-card distribution (133,784,560 hands)', () => {
  const counts = new Array<number>(9).fill(0)
  const st = Array.from({ length: 8 }, () => new Int32Array(8))
  const recurse = (depth: number, maxCard: number) => {
    if (depth === 7) {
      const s = st[7]!
      counts[categoryOf(scoreMasks(s[0]!, s[1]!, s[2]!, s[3]!, s[4]!, s[5]!, s[6]!, s[7]!))]!++
      return
    }
    for (let c = 6 - depth; c < maxCard; c++) {
      addInto(st[depth]!, st[depth + 1]!, c)
      recurse(depth + 1, c)
    }
  }
  recurse(0, 52)
  expect(counts).toEqual([
    23294460, 58627800, 31433400, 6461620, 6180020, 4047644, 3473184, 224848, 41584,
  ])
})
