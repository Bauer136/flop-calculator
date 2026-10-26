import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { parseCards } from './cards.ts'
import { CLASS_COMBOS, NUM_CLASSES, NUM_COMBOS } from './combos.ts'
import { comboCount, createRange, isSuitSymmetric, rangesEqual, removeCards } from './range.ts'
import { formatRange, parseRange, parseRangeStrict } from './rangeParser.ts'

const count = (text: string) => comboCount(parseRangeStrict(text))

describe('parseRange', () => {
  it.each([
    ['AA', 6],
    ['QQ+', 18],
    ['22+', 78],
    ['22-55', 24],
    ['55-22', 24],
    ['44-', 18],
    ['AKs', 4],
    ['AKo', 12],
    ['AK', 16],
    ['KA', 16],
    ['A2s+', 48],
    ['KTo+', 36],
    ['K9s-K6s', 16],
    ['A9s-', 32],
    ['AhKh', 1],
    ['random', 1326],
    ['QQ+, AKs AhKd', 23],
  ])('%s → %i combos', (text, expected) => {
    expect(count(text)).toBe(expected)
  })

  it('applies weights from colon and block syntax', () => {
    expect(count('AKs:0.5')).toBe(2)
    expect(count('AKs:50%')).toBe(2)
    expect(count('AKs:50')).toBe(2)
    expect(count('[25]AA,KK[/25],QQ')).toBe(3 + 6)
  })

  it('lets later items override earlier ones', () => {
    expect(count('AA,AA:0.5')).toBe(3)
    expect(count('AKs,AhKh:0')).toBe(3)
  })

  it('reports positioned errors and keeps valid items', () => {
    const { range, errors } = parseRange('AA, AKx, KK')
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ start: 4, end: 7 })
    expect(comboCount(range)).toBe(12)

    expect(parseRange('Q2s-K5s').errors[0]!.message).toMatch(/same top card/)
    expect(parseRange('AKs-AQo').errors[0]!.message).toMatch(/suitedness/)
    expect(parseRange('AAs').errors).toHaveLength(1)
    expect(parseRange('AhAh').errors).toHaveLength(1)
    expect(parseRange('AK:2x').errors).toHaveLength(1)
    expect(parseRange('[50]AK').errors[0]!.message).toMatch(/Unclosed/)
    expect(parseRange('AK[/50]').errors).toHaveLength(1)
  })

  it('removes board cards non-destructively', () => {
    const aa = parseRangeStrict('AA')
    expect(comboCount(removeCards(aa, parseCards('Ah')))).toBe(3)
    expect(comboCount(aa)).toBe(6)
  })
})

describe('formatRange', () => {
  it.each([
    ['AA,KK,QQ', 'QQ+'],
    ['22-55', '55-22'],
    ['A2s,A3s,A4s,A5s,AKs,AQs', 'AQs+,A5s-A2s'],
    ['AKs,AKo', 'AK'],
    ['KTo+', 'KTo+'],
    ['AA,[50]KK[/50]', 'AA,[50]KK[/50]'],
    ['AsKs', 'AsKs'],
    ['', ''],
  ])('%s → %s', (input, expected) => {
    expect(formatRange(parseRangeStrict(input))).toBe(expected)
  })

  it('writes the solver format with per-class weights', () => {
    expect(formatRange(parseRangeStrict('KK+,AKs:0.5'), 'solver')).toBe('AA,KK,AKs:0.5')
    expect(formatRange(parseRangeStrict('AhKh:0.25'), 'solver')).toBe('AhKh:0.25')
  })

  const weightArb = fc.constantFrom(0, 0, 0, 1, 1, 0.5, 0.25, 0.1234, 0.75)
  const classRangeArb = fc
    .array(weightArb, { minLength: NUM_CLASSES, maxLength: NUM_CLASSES })
    .map((ws) => {
      const r = createRange()
      ws.forEach((w, cls) => {
        for (const i of CLASS_COMBOS[cls]!) r[i] = w
      })
      return r
    })
  const comboRangeArb = fc
    .array(weightArb, { minLength: NUM_COMBOS, maxLength: NUM_COMBOS })
    .map((ws) => Float32Array.from(ws))

  it('round-trips random class-level ranges (both formats)', () => {
    fc.assert(
      fc.property(classRangeArb, (r) => {
        for (const format of ['compact', 'solver'] as const) {
          const text = formatRange(r, format)
          const back = parseRangeStrict(text)
          expect(rangesEqual(back, r, 1e-4)).toBe(true)
          expect(formatRange(back, format)).toBe(text)
        }
      }),
      { numRuns: 200 },
    )
  })

  it('round-trips random per-combo ranges', () => {
    fc.assert(
      fc.property(comboRangeArb, (r) => {
        const text = formatRange(r)
        expect(rangesEqual(parseRangeStrict(text), r, 1e-4)).toBe(true)
      }),
      { numRuns: 30 },
    )
  })

  it('detects suit symmetry', () => {
    expect(isSuitSymmetric(parseRangeStrict('QQ+,AK'))).toBe(true)
    expect(isSuitSymmetric(parseRangeStrict('QQ+,AhKh'))).toBe(false)
  })
})
