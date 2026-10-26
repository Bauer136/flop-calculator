import { describe, expect, it } from 'vitest'
import { parseCard } from './cards.ts'
import {
  CLASS_COMBOS,
  COMBO_CLASS,
  COMBO_INDEX,
  NUM_CLASSES,
  NUM_COMBOS,
  classAt,
  classKind,
  className,
  classOfCards,
  comboHigh,
  comboIndex,
  comboLow,
  formatCombo,
} from './combos.ts'

describe('combos', () => {
  it('indexes all 1,326 combos uniquely', () => {
    const seen = new Set<number>()
    for (let a = 0; a < 52; a++) {
      for (let b = 0; b < a; b++) {
        const i = comboIndex(a, b)
        expect(comboIndex(b, a)).toBe(i)
        expect(COMBO_INDEX[a * 52 + b]).toBe(i)
        expect(comboHigh(i)).toBe(a)
        expect(comboLow(i)).toBe(b)
        seen.add(i)
      }
    }
    expect(seen.size).toBe(NUM_COMBOS)
    expect(Math.max(...seen)).toBe(1325)
  })

  it('maps classes to the matrix layout', () => {
    expect(className(classAt(0, 0))).toBe('AA')
    expect(className(classAt(0, 1))).toBe('AKs')
    expect(className(classAt(1, 0))).toBe('AKo')
    expect(className(classAt(12, 12))).toBe('22')
    expect(className(classAt(11, 12))).toBe('32s')
    expect(classKind(classAt(3, 3))).toBe('pair')
  })

  it('assigns 6 / 4 / 12 combos to pairs / suited / offsuit classes', () => {
    let total = 0
    for (let cls = 0; cls < NUM_CLASSES; cls++) {
      const n = CLASS_COMBOS[cls]!.length
      const kind = classKind(cls)
      expect(n).toBe(kind === 'pair' ? 6 : kind === 'suited' ? 4 : 12)
      for (const i of CLASS_COMBOS[cls]!) expect(COMBO_CLASS[i]).toBe(cls)
      total += n
    }
    expect(total).toBe(1326)
  })

  it('classifies and formats specific combos', () => {
    const i = comboIndex(parseCard('Kh'), parseCard('Ah'))
    expect(formatCombo(i)).toBe('AhKh')
    expect(className(classOfCards(parseCard('Kh'), parseCard('Ah')))).toBe('AKs')
    expect(className(classOfCards(parseCard('Kd'), parseCard('Ah')))).toBe('AKo')
  })
})
