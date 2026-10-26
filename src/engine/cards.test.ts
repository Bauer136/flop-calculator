import { describe, expect, it } from 'vitest'
import {
  formatCard,
  makeCard,
  parseCard,
  parseCards,
  rankOf,
  remainingCards,
  suitOf,
  tryParseCard,
} from './cards.ts'

describe('cards', () => {
  it('encodes rank and suit', () => {
    const ah = parseCard('Ah')
    expect(rankOf(ah)).toBe(12)
    expect(suitOf(ah)).toBe(2)
    expect(ah).toBe(makeCard(12, 2))
    expect(parseCard('2c')).toBe(0)
    expect(parseCard('As')).toBe(51)
  })

  it('round-trips every card', () => {
    for (let c = 0; c < 52; c++) expect(parseCard(formatCard(c))).toBe(c)
  })

  it('accepts lowercase ranks, uppercase suits and "10"', () => {
    expect(parseCard('tD')).toBe(parseCard('Td'))
    expect(parseCard('10h')).toBe(parseCard('Th'))
    expect(tryParseCard('1h')).toBe(-1)
    expect(tryParseCard('Ax')).toBe(-1)
    expect(tryParseCard('')).toBe(-1)
  })

  it('parses card lists in several layouts', () => {
    const expected = [parseCard('Ks'), parseCard('7d'), parseCard('2c')]
    expect(parseCards('Ks7d2c')).toEqual(expected)
    expect(parseCards('Ks 7d, 2c')).toEqual(expected)
    expect(parseCards('')).toEqual([])
    expect(() => parseCards('KsKs')).toThrow(/Duplicate/)
    expect(() => parseCards('Ks7')).toThrow()
  })

  it('lists remaining cards', () => {
    expect(remainingCards(parseCards('Ks7d2c'))).toHaveLength(49)
  })
})
