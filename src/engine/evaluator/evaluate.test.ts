import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { parseCards } from '../cards.ts'
import {
  FLUSH,
  FULL_HOUSE,
  PAIR,
  STRAIGHT,
  STRAIGHT_FLUSH,
  TWO_PAIR,
  boardMasks,
  categoryOf,
  evaluate,
  evaluateWithBoard,
} from './evaluate.ts'

const ev = (text: string) => evaluate(parseCards(text))

describe('evaluate', () => {
  it('matches the exhaustive 5-card distribution and has 7,462 distinct values', () => {
    const counts = new Array<number>(9).fill(0)
    const values = new Set<number>()
    const cards = new Uint8Array(5)
    for (let a = 4; a < 52; a++) {
      cards[0] = a
      for (let b = 3; b < a; b++) {
        cards[1] = b
        for (let c = 2; c < b; c++) {
          cards[2] = c
          for (let d = 1; d < c; d++) {
            cards[3] = d
            for (let e = 0; e < d; e++) {
              cards[4] = e
              const v = evaluate(cards, 5)
              counts[categoryOf(v)]!++
              values.add(v)
            }
          }
        }
      }
    }
    expect(counts).toEqual([1302540, 1098240, 123552, 54912, 10200, 5108, 3744, 624, 40])
    expect(values.size).toBe(7462)
  })

  it('orders well-known hands', () => {
    const ladder = [
      '7c5d4h3s2c', // worst high card
      'AhKdQcJs9h',
      '2c2d3h4s5c'.replace('5c', '6c'), // pair of deuces
      'AcAdKhQsJc',
      '3c3d2h2s4c',
      'AcAdKhKsQc',
      '2c2d2h3s4c',
      'Ac2d3h4s5c', // wheel
      '2c3d4h5s6c',
      'TcJdQhKsAc',
      '2h4h6h8hTh',
      'AhKhQhJh9h',
      '2c2d2h3s3c',
      'AcAdAhKsKc',
      '2c2d2h2s3c',
      'AcAdAhAsKc',
      'Ah2h3h4h5h', // steel wheel
      'TsJsQsKsAs',
    ].map(ev)
    for (let i = 1; i < ladder.length; i++) expect(ladder[i]!).toBeGreaterThan(ladder[i - 1]!)
  })

  it('picks the best five of seven', () => {
    expect(categoryOf(ev('AhKhQhJh2c3d9h'))).toBe(FLUSH)
    expect(categoryOf(ev('AhKdQcJsTh9h8h'))).toBe(STRAIGHT)
    expect(categoryOf(ev('9h8h7h6h5h4h3h'))).toBe(STRAIGHT_FLUSH)
    expect(categoryOf(ev('AhAdAcKsKhKd2c'))).toBe(FULL_HOUSE)
    expect(categoryOf(ev('AhAdKcKsQhQd2c'))).toBe(TWO_PAIR)
    expect(ev('AhAdKcKsQhQd2c')).toBe(ev('AhAdKcKsQh'))
    expect(categoryOf(ev('Ah2d4c6s8hTdQc'))).not.toBe(PAIR)
    // Counterfeited kicker: board pair plays, highest kicker wins.
    expect(ev('KhKd7c7s2hAcQd')).toBeGreaterThan(ev('KhKd7c7s2hQcJd'))
  })

  it('evaluateWithBoard matches evaluate on random hands', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 51 }), { minLength: 7, maxLength: 7 }),
        (cs) => {
          for (const boardLen of [3, 4, 5]) {
            const board = cs.slice(0, boardLen)
            const h1 = cs[5]!
            const h2 = cs[6]!
            const masks = boardMasks(board)
            expect(evaluateWithBoard(masks, h1, h2)).toBe(evaluate([...board, h1, h2]))
          }
        },
      ),
      { numRuns: 2000 },
    )
  })
})
