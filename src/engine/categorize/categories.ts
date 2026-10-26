/**
 * Hand categories (see docs/hand-categories.md for the exact rules).
 *
 * A classification is packed into one integer:
 *   bits 0-3  made-hand id (exclusive)
 *   bits 4-5  top-pair kicker class
 *   bits 6+   draw flags (non-exclusive)
 */

export const MADE = {
  StraightFlush: 0,
  Quads: 1,
  FullHouse: 2,
  Flush: 3,
  Straight: 4,
  BoardPlays: 5,
  Set: 6,
  Trips: 7,
  TwoPair: 8,
  Overpair: 9,
  TopPair: 10,
  PPBelowTopPair: 11,
  MiddlePair: 12,
  WeakPair: 13,
  AceHigh: 14,
  NoMadeHand: 15,
} as const
export type MadeId = (typeof MADE)[keyof typeof MADE]
export const NUM_MADE = 16

export const MADE_LABELS: readonly string[] = [
  'Straight flush',
  'Quads',
  'Full house',
  'Flush',
  'Straight',
  'Board plays',
  'Set',
  'Trips',
  'Two pair',
  'Overpair',
  'Top pair',
  'PP below top pair',
  'Middle pair',
  'Weak pair',
  'Ace high',
  'No made hand',
]

export const KICKER = { None: 0, Top: 1, Good: 2, Weak: 3 } as const
export type KickerId = (typeof KICKER)[keyof typeof KICKER]

export const DRAW = {
  FlushDraw: 1 << 0,
  NutFlushDraw: 1 << 1,
  FlushDraw2Card: 1 << 2,
  FlushDraw1Card: 1 << 3,
  BackdoorFlushDraw: 1 << 4,
  BackdoorFlushDraw2Card: 1 << 5,
  BackdoorFlushDraw1Card: 1 << 6,
  OESD: 1 << 7,
  Gutshot: 1 << 8,
  BackdoorStraightDraw: 1 << 9,
  Overcards: 1 << 10,
} as const

export const packClass = (made: number, kicker: number, draws: number): number =>
  made | (kicker << 4) | (draws << 6)
export const madeOf = (packed: number): number => packed & 15
export const kickerOf = (packed: number): number => (packed >> 4) & 3
export const drawsOf = (packed: number): number => packed >>> 6

/** Identifier of a built-in stat ('made.set', 'draw.oesd', …) or a custom stat ('custom.<id>'). */
export type StatId = string

export interface StatDef {
  id: StatId
  label: string
  section: 'made' | 'draws'
  /** 0 for a main row, 1 for a sub-row shown indented under its parent. */
  depth: 0 | 1
  /** Streets where the stat can be non-zero. */
  streets: readonly ('flop' | 'turn' | 'river')[]
  test: (packed: number) => boolean
}

const ALL = ['flop', 'turn', 'river'] as const
const DRAW_STREETS = ['flop', 'turn'] as const
const FLOP = ['flop'] as const

const made =
  (id: MadeId): ((p: number) => boolean) =>
  (p) =>
    madeOf(p) === id
const hasDraw =
  (flag: number): ((p: number) => boolean) =>
  (p) =>
    (drawsOf(p) & flag) !== 0
const STRAIGHT_DRAWS = DRAW.OESD | DRAW.Gutshot
const ANY_FD = DRAW.FlushDraw | DRAW.BackdoorFlushDraw

const MADE_IDS: Record<number, string> = {
  [MADE.StraightFlush]: 'made.straightFlush',
  [MADE.Quads]: 'made.quads',
  [MADE.FullHouse]: 'made.fullHouse',
  [MADE.Flush]: 'made.flush',
  [MADE.Straight]: 'made.straight',
  [MADE.BoardPlays]: 'made.boardPlays',
  [MADE.Set]: 'made.set',
  [MADE.Trips]: 'made.trips',
  [MADE.TwoPair]: 'made.twoPair',
  [MADE.Overpair]: 'made.overpair',
  [MADE.TopPair]: 'made.topPair',
  [MADE.PPBelowTopPair]: 'made.ppBelowTopPair',
  [MADE.MiddlePair]: 'made.middlePair',
  [MADE.WeakPair]: 'made.weakPair',
  [MADE.AceHigh]: 'made.aceHigh',
  [MADE.NoMadeHand]: 'made.noMadeHand',
}

export const madeStatId = (id: number): StatId => MADE_IDS[id]!

function buildStats(): StatDef[] {
  const stats: StatDef[] = []
  for (let id = 0; id < NUM_MADE; id++) {
    stats.push({
      id: MADE_IDS[id]!,
      label: MADE_LABELS[id]!,
      section: 'made',
      depth: 0,
      streets: id === MADE.BoardPlays ? ['river'] : ALL,
      test: made(id as MadeId),
    })
    if (id === MADE.TopPair) {
      const kickers: [string, string, number][] = [
        ['made.topPair.topKicker', 'Top kicker', KICKER.Top],
        ['made.topPair.goodKicker', 'Good kicker', KICKER.Good],
        ['made.topPair.weakKicker', 'Weak kicker', KICKER.Weak],
      ]
      for (const [kid, label, k] of kickers) {
        stats.push({
          id: kid,
          label,
          section: 'made',
          depth: 1,
          streets: ALL,
          test: (p) => madeOf(p) === MADE.TopPair && kickerOf(p) === k,
        })
      }
    }
  }

  const draws: Omit<StatDef, 'section'>[] = [
    {
      id: 'draw.flushDraw',
      label: 'Flush draw',
      depth: 0,
      streets: DRAW_STREETS,
      test: hasDraw(DRAW.FlushDraw),
    },
    {
      id: 'draw.flushDraw.nut',
      label: 'Nut flush draw',
      depth: 1,
      streets: DRAW_STREETS,
      test: hasDraw(DRAW.NutFlushDraw),
    },
    {
      id: 'draw.flushDraw.2card',
      label: '2-card flush draw',
      depth: 1,
      streets: DRAW_STREETS,
      test: hasDraw(DRAW.FlushDraw2Card),
    },
    {
      id: 'draw.flushDraw.1card',
      label: '1-card flush draw',
      depth: 1,
      streets: DRAW_STREETS,
      test: hasDraw(DRAW.FlushDraw1Card),
    },
    {
      id: 'draw.backdoorFlushDraw',
      label: 'Backdoor flush draw',
      depth: 0,
      streets: FLOP,
      test: hasDraw(DRAW.BackdoorFlushDraw),
    },
    {
      id: 'draw.backdoorFlushDraw.2card',
      label: '2-card backdoor FD',
      depth: 1,
      streets: FLOP,
      test: hasDraw(DRAW.BackdoorFlushDraw2Card),
    },
    {
      id: 'draw.backdoorFlushDraw.1card',
      label: '1-card backdoor FD',
      depth: 1,
      streets: FLOP,
      test: hasDraw(DRAW.BackdoorFlushDraw1Card),
    },
    {
      id: 'draw.noFlushDraw',
      label: 'No flush draw',
      depth: 0,
      streets: DRAW_STREETS,
      test: (p) =>
        (drawsOf(p) & ANY_FD) === 0 && madeOf(p) !== MADE.Flush && madeOf(p) !== MADE.StraightFlush,
    },
    { id: 'draw.oesd', label: 'OESD', depth: 0, streets: DRAW_STREETS, test: hasDraw(DRAW.OESD) },
    {
      id: 'draw.gutshot',
      label: 'Gutshot',
      depth: 0,
      streets: DRAW_STREETS,
      test: hasDraw(DRAW.Gutshot),
    },
    {
      id: 'draw.backdoorStraightDraw',
      label: 'Backdoor straight draw',
      depth: 0,
      streets: FLOP,
      test: hasDraw(DRAW.BackdoorStraightDraw),
    },
    {
      id: 'draw.overcards',
      label: 'Overcards',
      depth: 0,
      streets: DRAW_STREETS,
      test: hasDraw(DRAW.Overcards),
    },
    {
      id: 'draw.comboDraw',
      label: 'Combo draw (FD + straight draw)',
      depth: 0,
      streets: DRAW_STREETS,
      test: (p) => (drawsOf(p) & DRAW.FlushDraw) !== 0 && (drawsOf(p) & STRAIGHT_DRAWS) !== 0,
    },
    {
      id: 'draw.air',
      label: 'Air (no pair, no draw)',
      depth: 0,
      streets: DRAW_STREETS,
      test: (p) =>
        madeOf(p) >= MADE.AceHigh && (drawsOf(p) & (DRAW.FlushDraw | STRAIGHT_DRAWS)) === 0,
    },
  ]
  for (const d of draws) stats.push({ ...d, section: 'draws' })
  return stats
}

export const BUILTIN_STATS: readonly StatDef[] = buildStats()
export const BUILTIN_STAT_BY_ID: ReadonlyMap<StatId, StatDef> = new Map(
  BUILTIN_STATS.map((s) => [s.id, s]),
)
