import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { parseCards } from '../cards.ts'
import { NUM_COMBOS } from '../combos.ts'
import { fullRange } from '../range.ts'
import { DRAW, KICKER, MADE, MADE_LABELS, drawsOf, kickerOf, madeOf } from './categories.ts'
import { boardInfo, classify, classifyRange } from './classify.ts'

/** Short draw codes used in the golden table, expanded to flag sets. */
const DRAW_CODES: Record<string, number> = {
  nfd2: DRAW.FlushDraw | DRAW.NutFlushDraw | DRAW.FlushDraw2Card,
  nfd1: DRAW.FlushDraw | DRAW.NutFlushDraw | DRAW.FlushDraw1Card,
  fd2: DRAW.FlushDraw | DRAW.FlushDraw2Card,
  fd1: DRAW.FlushDraw | DRAW.FlushDraw1Card,
  bdfd2: DRAW.BackdoorFlushDraw | DRAW.BackdoorFlushDraw2Card,
  bdfd1: DRAW.BackdoorFlushDraw | DRAW.BackdoorFlushDraw1Card,
  oesd: DRAW.OESD,
  gut: DRAW.Gutshot,
  bdsd: DRAW.BackdoorStraightDraw,
  over: DRAW.Overcards,
}

type Made = keyof typeof MADE
type Golden = [
  hole: string,
  board: string,
  made: Made,
  draws: string[],
  kicker?: keyof typeof KICKER,
]

const GOLDEN: Golden[] = [
  // Rainbow K-high flop
  ['AsAh', 'Ks7d2c', 'Overpair', []],
  ['KhKd', 'Ks7d2c', 'Set', []],
  ['AhKh', 'Ks7d2c', 'TopPair', [], 'Top'],
  ['KhQh', 'Ks7d2c', 'TopPair', [], 'Good'],
  ['KhJh', 'Ks7d2c', 'TopPair', [], 'Good'],
  ['KhTh', 'Ks7d2c', 'TopPair', [], 'Weak'],
  ['Kh5h', 'Ks7d2c', 'TopPair', [], 'Weak'],
  ['7h7s', 'Ks7d2c', 'Set', []],
  ['7h6h', 'Ks7d2c', 'MiddlePair', []],
  ['2h2d', 'Ks7d2c', 'Set', []],
  ['QhQd', 'Ks7d2c', 'PPBelowTopPair', []],
  ['5h5d', 'Ks7d2c', 'WeakPair', []],
  ['As2s', 'Ks7d2c', 'WeakPair', ['bdfd2']],
  ['AhQd', 'Ks7d2c', 'AceHigh', ['bdsd']],
  ['6h5h', 'Ks7d2c', 'NoMadeHand', ['bdsd']],
  ['Kh7h', 'Ks7d2c', 'TwoPair', []],
  ['7h2h', 'Ks7d2c', 'TwoPair', []],

  // Two-tone 9-8 flop
  ['AhKh', '9h8h2c', 'AceHigh', ['nfd2', 'over']],
  ['JhTh', '9h8h2c', 'NoMadeHand', ['fd2', 'oesd', 'over']],
  ['Th7c', '9h8h2c', 'NoMadeHand', ['oesd', 'bdfd1']],
  ['Jc7d', '9h8h2c', 'NoMadeHand', ['gut']],
  ['Jc6d', '9h8h2c', 'NoMadeHand', ['bdsd']],
  ['9c9d', '9h8h2c', 'Set', []],
  ['Ac9c', '9h8h2c', 'TopPair', ['bdfd2'], 'Top'],
  ['8d7d', '9h8h2c', 'MiddlePair', ['bdsd']],
  ['2h2d', '9h8h2c', 'Set', ['bdfd1']],

  // Double gutshot counts as OESD
  ['8s7s', 'Jc9d5h', 'NoMadeHand', ['oesd']],
  ['Jh9c', 'Th8d2c', 'NoMadeHand', ['oesd']],

  // Wheels
  ['As2s', '4c3d9h', 'AceHigh', ['gut']],
  ['As5s', '4c3d2h', 'Straight', []],
  ['6s5s', '4c3d2h', 'Straight', []],
  ['4h5h', 'Ah2h3h', 'StraightFlush', []],

  // Straight on the board at the river
  ['AhAd', '9c8d7h6sTc', 'BoardPlays', []],
  ['Jh2d', '9c8d7h6sTc', 'Straight', []],
  ['5h2d', '9c8d7h6sTc', 'BoardPlays', []],
  ['5h5d', '5c6d7h8s9c', 'BoardPlays', []],

  // Paired flop
  ['Ks5s', 'KcKd7h', 'Trips', []],
  ['7c7d', 'KcKd7h', 'FullHouse', []],
  ['Ah7s', 'KcKd7h', 'WeakPair', []],
  ['Kh7s', 'KcKd7h', 'FullHouse', []],
  ['QhQs', 'KcKd7h', 'PPBelowTopPair', []],
  ['AhAs', 'KcKd7h', 'Overpair', []],
  ['AhQh', 'KcKd7h', 'AceHigh', ['bdfd2', 'bdsd']],
  ['6s5s', 'KcKd7h', 'NoMadeHand', ['bdsd']],
  ['9h5s', '9c9d5h', 'FullHouse', []],
  ['5s4s', '9c9d5h', 'WeakPair', []],

  // Trips on the board: any pocket pair makes a full house
  ['AsAd', '7c7d7h', 'FullHouse', []],
  ['5s5d', '7c7d7h', 'FullHouse', []],
  ['AsKd', '7c7d7h', 'AceHigh', ['over']],
  ['7s2c', '7c7d7h', 'Quads', []],
  ['Kh2c', '7c7d7h', 'NoMadeHand', []],

  // Quads on the board at the turn
  ['Ah2c', 'KcKdKhKs', 'AceHigh', []],
  ['QhQd', 'KcKdKhKs', 'PPBelowTopPair', []],

  // Four-flush turn
  ['AhKc', '2h5h9hJh', 'Flush', []],
  ['AcKc', '2h5h9hJh', 'AceHigh', ['over']],
  ['QhTd', '2h5h9hJh', 'Flush', ['oesd']],

  // Monotone flop
  ['AsQd', 'Ks8s3s', 'AceHigh', ['nfd1', 'bdsd']],
  ['AsQs', 'Ks8s3s', 'Flush', ['bdsd']],
  ['QsJd', 'Ks8s3s', 'NoMadeHand', ['fd1', 'bdsd']],
  ['5h4h', 'Ks8s3s', 'NoMadeHand', ['bdsd']],

  // Nut flush draw when the suit's ace is on the board
  ['KhQh', 'Ah7h2c', 'NoMadeHand', ['nfd2', 'bdsd']],
  ['QhJh', 'Ah7h2c', 'NoMadeHand', ['fd2', 'bdsd']],

  // Four-straight turn: outs the board makes alone don't count
  ['AhKd', '5c6d7h8s', 'AceHigh', ['over']],
  ['9h2d', '5c6d7h8s', 'Straight', []],
  ['4h2d', '5c6d7h8s', 'Straight', []],
  ['Th2d', '5c6d7h8s', 'NoMadeHand', ['gut']],

  // Top-pair kickers with an ace on the board
  ['AhKd', 'As8d3c', 'TopPair', [], 'Top'],
  ['AhQd', 'As8d3c', 'TopPair', [], 'Good'],
  ['AhJd', 'As8d3c', 'TopPair', [], 'Good'],
  ['AhTd', 'As8d3c', 'TopPair', [], 'Weak'],

  // Turn: middle and weak pairs
  ['9h8h', 'Ks9d5c2h', 'MiddlePair', []],
  ['5h4h', 'Ks9d5c2h', 'WeakPair', []],
  ['4h3d', 'Ks9d5c2h', 'NoMadeHand', ['oesd']],
  ['3h3d', 'Ks9d5c2h', 'WeakPair', []],

  // River: no draws
  ['4h3d', 'Ks9d5c2h7s', 'NoMadeHand', []],
  ['QhJh', 'Ks9d5c2h7s', 'NoMadeHand', []],
  ['3c2c', 'AsKsQsJsTs', 'BoardPlays', []],
  ['Th2s', '9h8h7h2c3d', 'WeakPair', []],
  ['ThJh', '9h8h7h2c3d', 'StraightFlush', []],
  ['6h5h', '9h8h7h2c3d', 'StraightFlush', []],

  // Flush on the board at the river
  ['Ah3c', '2h5h9hJhKh', 'Flush', []],
  ['3h4c', '2h5h9hJhKh', 'Flush', []],
  ['AcAd', '2h5h9hJhKh', 'BoardPlays', []],

  // Full house on the board at the river
  ['AhAs', 'KcKdKh7c7d', 'FullHouse', []],
  ['7h2s', 'KcKdKh7c7d', 'BoardPlays', []],
  ['Ks2s', 'KcKdKh7c7d', 'Quads', []],
  ['Qh2s', 'KcKdKh7c7d', 'BoardPlays', []],
]

describe('classify golden cases', () => {
  it.each(GOLDEN)('%s on %s → %s %j', (hole, board, made, draws, kicker) => {
    const [c1, c2] = parseCards(hole) as [number, number]
    const packed = classify(c1, c2, boardInfo(parseCards(board)))
    expect(MADE_LABELS[madeOf(packed)]).toBe(MADE_LABELS[MADE[made]])
    const expectedDraws = draws.reduce((acc, code) => acc | DRAW_CODES[code]!, 0)
    expect(drawsOf(packed).toString(2)).toBe(expectedDraws.toString(2))
    expect(kickerOf(packed)).toBe(kicker ? KICKER[kicker] : 0)
  })

  it('has at least 80 cases', () => {
    expect(GOLDEN.length).toBeGreaterThanOrEqual(80)
  })
})

describe('classify invariants', () => {
  const boardArb = fc
    .integer({ min: 3, max: 5 })
    .chain((n) => fc.uniqueArray(fc.integer({ min: 0, max: 51 }), { minLength: n, maxLength: n }))

  it('classifies every live combo exactly once, with no draws on the river', () => {
    fc.assert(
      fc.property(boardArb, (board) => {
        const info = boardInfo(board)
        const classes = classifyRange(fullRange(), info)
        let live = 0
        const madeCounts = new Array<number>(16).fill(0)
        for (let i = 0; i < NUM_COMBOS; i++) {
          const p = classes[i]!
          if (p < 0) continue
          live++
          madeCounts[madeOf(p)]!++
          if (board.length === 5) expect(drawsOf(p)).toBe(0)
          if (madeOf(p) !== MADE.TopPair) expect(kickerOf(p)).toBe(0)
          if (board.length < 5) expect(madeOf(p)).not.toBe(MADE.BoardPlays)
        }
        const remaining = 52 - board.length
        expect(live).toBe((remaining * (remaining - 1)) / 2)
        expect(madeCounts.reduce((a, b) => a + b, 0)).toBe(live)
      }),
      { numRuns: 150 },
    )
  })

  it('never reports a draw to a hand already made', () => {
    fc.assert(
      fc.property(
        boardArb.filter((b) => b.length < 5),
        (board) => {
          const classes = classifyRange(fullRange(), boardInfo(board))
          for (const p of classes) {
            if (p < 0) continue
            const m = madeOf(p)
            const d = drawsOf(p)
            if (m === MADE.Flush || m === MADE.StraightFlush) {
              expect(d & (DRAW.FlushDraw | DRAW.BackdoorFlushDraw)).toBe(0)
            }
            if (m === MADE.Straight || m === MADE.StraightFlush) {
              expect(d & (DRAW.OESD | DRAW.Gutshot | DRAW.BackdoorStraightDraw)).toBe(0)
            }
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
