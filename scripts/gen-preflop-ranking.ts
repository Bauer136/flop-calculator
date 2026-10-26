/**
 * Generates src/engine/data/preflopRanking.json: the 169 starting-hand classes ordered
 * by all-in equity against one random hand (Monte Carlo, fixed seed).
 *
 *   node scripts/gen-preflop-ranking.ts [trialsPerClass]
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CLASS_COMBOS, NUM_CLASSES, className } from '../src/engine/combos.ts'
import { monteCarloEquity } from '../src/engine/equity/monteCarlo.ts'
import { createRange, fullRange } from '../src/engine/range.ts'

const trials = Number(process.argv[2] ?? 400_000)
const out = fileURLToPath(new URL('../src/engine/data/preflopRanking.json', import.meta.url))

const rows: { hand: string; equity: number }[] = []
for (let cls = 0; cls < NUM_CLASSES; cls++) {
  // Classes are suit-symmetric, so one representative combo is enough.
  const hero = createRange()
  hero[CLASS_COMBOS[cls]![0]!] = 1
  const res = monteCarloEquity([hero, fullRange()], [], [], { seed: 1000 + cls, maxTrials: trials })
  rows.push({ hand: className(cls), equity: Number(res.players[0]!.toFixed(5)) })
  process.stdout.write(`\r${cls + 1}/${NUM_CLASSES}`)
}
rows.sort((a, b) => b.equity - a.equity)

writeFileSync(
  out,
  JSON.stringify(
    {
      description: 'Starting hands ordered by all-in equity vs one random hand (Monte Carlo).',
      trialsPerClass: trials,
      order: rows.map((r) => r.hand),
      equity: Object.fromEntries(rows.map((r) => [r.hand, r.equity])),
    },
    null,
    2,
  ) + '\n',
)
console.log(`\nWrote ${out}`)
