import { describe, expect, it } from 'vitest'
import { parseCards } from '../cards.ts'
import { MADE, madeOf } from '../categorize/categories.ts'
import { comboCount } from '../range.ts'
import { parseRangeStrict } from '../rangeParser.ts'
import { anyOfStats, compileCondition, describeCondition } from './conditions.ts'
import { type FilterStep, applyFilters } from './filters.ts'
import { assignGroups } from './groups.ts'
import { nextCardStats } from './nextCard.ts'
import { computeStats } from './stats.ts'
import { emptyStreetFilters, runStreets } from './streets.ts'

const row = (stats: { rows: { id: string; combos: number; percent: number }[] }, id: string) =>
  stats.rows.find((r) => r.id === id)!

const keep = (stats: string[], weight = 1, inverted = false): FilterStep => ({
  id: 'f',
  condition: anyOfStats(stats),
  mode: 'keep',
  weight,
  inverted,
})

describe('computeStats', () => {
  it('counts AA,KK,AKs on Ks7d2c', () => {
    const stats = computeStats(parseRangeStrict('AA,KK,AKs'), parseCards('Ks7d2c'))
    expect(stats.total).toBe(12)
    expect(row(stats, 'made.set')).toMatchObject({ combos: 3, percent: 25 })
    expect(row(stats, 'made.overpair')).toMatchObject({ combos: 6, percent: 50 })
    expect(row(stats, 'made.topPair')).toMatchObject({ combos: 3, percent: 25 })
    expect(row(stats, 'made.topPair.topKicker').combos).toBe(3)
  })

  it('honours dead cards and weights', () => {
    const stats = computeStats(
      parseRangeStrict('AA:0.5,KK'),
      parseCards('Ks7d2c'),
      parseCards('Ah'),
    )
    expect(row(stats, 'made.overpair').combos).toBe(1.5)
    expect(stats.total).toBe(4.5)
  })

  it('made-hand rows sum to the total', () => {
    const stats = computeStats(parseRangeStrict('random'), parseCards('9h8h2c'))
    const madeSum = stats.rows
      .filter((r) => r.section === 'made' && r.depth === 0)
      .reduce((a, r) => a + r.combos, 0)
    expect(madeSum).toBeCloseTo(stats.total)
    expect(stats.total).toBe(1176)
  })

  it('adds custom stats, including the suits operator', () => {
    const ctx = {
      customStats: [
        {
          id: 'pairPlusFd',
          name: 'Pair + FD',
          condition: {
            type: 'and' as const,
            items: [
              anyOfStats(['made.topPair', 'made.middlePair']),
              { type: 'stat' as const, stat: 'draw.flushDraw' },
            ],
          },
        },
        {
          id: 'hearts',
          name: 'Has a heart',
          condition: { type: 'suit' as const, suit: 2, min: 1 as const },
        },
        { id: 'loop', name: 'Loop', condition: { type: 'stat' as const, stat: 'custom.loop' } },
      ],
    }
    const stats = computeStats(parseRangeStrict('AhKh,9h7h,Ah9c'), parseCards('9d8h2h'), [], ctx)
    expect(row(stats, 'custom.pairPlusFd').combos).toBe(1) // 9h7h: top pair + flush draw
    expect(row(stats, 'custom.hearts').combos).toBe(3)
    expect(row(stats, 'custom.loop').combos).toBe(0)
  })
})

describe('filters and streets', () => {
  const range = parseRangeStrict('AA,KK,AKs,QJs')
  const flop = parseCards('Ks7d2c')

  it('keeps, removes, weights and inverts', () => {
    const stats = computeStats(range, flop)
    const tp = ['made.topPair', 'made.set', 'made.overpair']
    expect(comboCount(applyFilters(stats.weights, stats.classes, [keep(tp)]))).toBe(12)
    expect(comboCount(applyFilters(stats.weights, stats.classes, [keep(tp, 0.5)]))).toBe(6)
    expect(comboCount(applyFilters(stats.weights, stats.classes, [keep(tp, 1, true)]))).toBe(4)
    const remove: FilterStep = { ...keep(['made.set']), mode: 'remove' }
    expect(comboCount(applyFilters(stats.weights, stats.classes, [remove]))).toBe(13)
    expect(
      comboCount(applyFilters(stats.weights, stats.classes, [{ ...remove, weight: 0.5 }])),
    ).toBe(14.5)
  })

  it('feeds each street the previous street’s filtered range', () => {
    const filters = emptyStreetFilters()
    filters.flop = [keep(['made.topPair'])]
    const board = parseCards('Ks7d2cQh')
    const result = runStreets(range, board, [], filters)
    expect(result.streets.map((s) => s.street)).toEqual(['flop', 'turn'])
    expect(result.streets[0]!.stats.total).toBe(16)
    // Turn sees only the 3 AKs top-pair combos.
    expect(result.streets[1]!.stats.total).toBe(3)

    // Changing the flop filter recomputes the turn.
    filters.flop = [keep(['made.overpair'])]
    const again = runStreets(range, board, [], filters)
    expect(again.streets[1]!.stats.total).toBe(6)
    expect(row(again.streets[1]!.stats, 'made.overpair').combos).toBe(6)
  })
})

describe('nextCardStats', () => {
  it('returns one row per unseen card with consistent made-hand totals', () => {
    const range = parseRangeStrict('random')
    const flop = parseCards('Ks7d2c')
    const result = nextCardStats(range, flop, parseCards('Ah'))
    expect(result.rows).toHaveLength(48)
    const madeIdx = result.statIds
      .map((id, k) => (id.startsWith('made.') && id.split('.').length === 2 ? k : -1))
      .filter((k) => k >= 0)
    for (const r of result.rows) {
      const sum = madeIdx.reduce((a, k) => a + r.counts[k]!, 0)
      expect(sum).toBeCloseTo(r.total)
      expect(r.total).toBe((47 * 46) / 2)
    }
  })
})

describe('groups', () => {
  it('puts each combo in at most one group, by priority', () => {
    const stats = computeStats(parseRangeStrict('random'), parseCards('Ks7d2c'))
    const groups = [
      {
        id: 'a',
        name: 'Strong',
        color: '#f00',
        condition: anyOfStats(['made.set', 'made.twoPair']),
      },
      {
        id: 'b',
        name: 'Pairs',
        color: '#0f0',
        condition: anyOfStats(['made.set', 'made.topPair']),
      },
    ]
    const g = assignGroups(stats.weights, stats.classes, groups)
    expect(g.totals[0]! + g.totals[1]! + g.ungrouped).toBeCloseTo(g.total)
    expect(g.totals[0]).toBe(row(stats, 'made.set').combos + row(stats, 'made.twoPair').combos)
    expect(g.totals[1]).toBe(row(stats, 'made.topPair').combos)
    for (let i = 0; i < 1326; i++) {
      if (g.groupOf[i] === 1) expect(madeOf(stats.classes[i]!)).toBe(MADE.TopPair)
    }
  })
})

describe('conditions', () => {
  it('describes and evaluates compound conditions', () => {
    const c = {
      type: 'and' as const,
      items: [
        anyOfStats(['made.topPair', 'made.overpair']),
        { type: 'not' as const, item: { type: 'suited' as const, suited: true } },
      ],
    }
    expect(describeCondition(c)).toBe('(Top pair OR Overpair) AND NOT Suited')
    const stats = computeStats(parseRangeStrict('AK'), parseCards('Ks7d2c'))
    const test = compileCondition(c)
    let n = 0
    stats.classes.forEach((p, i) => {
      if (p >= 0 && test(p, i)) n += stats.weights[i]!
    })
    expect(n).toBe(9) // offsuit AK with a live K: 3 kings × 3 non-matching aces
  })

  it('matches equity ranges only when equity is supplied', () => {
    const eq = new Float32Array(1326).fill(0.6)
    expect(compileCondition({ type: 'equity', min: 0.5, max: 1 }, { equity: eq })(0, 0)).toBe(true)
    expect(compileCondition({ type: 'equity', min: 0.5, max: 1 })(0, 0)).toBe(false)
  })
})
