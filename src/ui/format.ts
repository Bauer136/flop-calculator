import {
  type Card,
  DRAW,
  KICKER,
  MADE_LABELS,
  RANK_CHARS,
  drawsOf,
  kickerOf,
  madeOf,
  rankOf,
  suitOf,
} from '../engine/index.ts'

export const SUIT_SYMBOLS = ['♣', '♦', '♥', '♠'] as const
export const SUIT_NAMES = ['clubs', 'diamonds', 'hearts', 'spades'] as const

export const suitVar = (suit: number): string => `var(--suit-${SUIT_NAMES[suit]})`

export function cardLabel(card: Card): { rank: string; suit: string; color: string } {
  return {
    rank: RANK_CHARS.charAt(rankOf(card)),
    suit: SUIT_SYMBOLS[suitOf(card)]!,
    color: suitVar(suitOf(card)),
  }
}

/** Accessible card name, e.g. "King of spades". */
export function cardName(card: Card): string {
  const names = [
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Jack',
    'Queen',
    'King',
    'Ace',
  ]
  return `${names[rankOf(card)]} of ${SUIT_NAMES[suitOf(card)]}`
}

export function formatCombos(n: number): string {
  if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n))
  return n.toFixed(n < 10 ? 2 : 1)
}

export function formatPercent(fraction0to100: number, digits = 1): string {
  return `${fraction0to100.toFixed(digits)}%`
}

export function formatEquity(eq: number, digits = 2): string {
  return Number.isFinite(eq) ? `${(eq * 100).toFixed(digits)}%` : '—'
}

const KICKER_LABELS: Record<number, string> = {
  [KICKER.Top]: 'top kicker',
  [KICKER.Good]: 'good kicker',
  [KICKER.Weak]: 'weak kicker',
}

const DRAW_LABELS: [number, string][] = [
  [DRAW.NutFlushDraw, 'Nut flush draw'],
  [DRAW.FlushDraw, 'Flush draw'],
  [DRAW.BackdoorFlushDraw, 'Backdoor flush draw'],
  [DRAW.OESD, 'OESD'],
  [DRAW.Gutshot, 'Gutshot'],
  [DRAW.BackdoorStraightDraw, 'Backdoor straight draw'],
  [DRAW.Overcards, 'Overcards'],
]

/** "Top pair (top kicker) · Nut flush draw, Gutshot" for a packed classification. */
export function describeClassification(packed: number): string {
  const made = MADE_LABELS[madeOf(packed)]!
  const kicker = KICKER_LABELS[kickerOf(packed)]
  const draws = drawsOf(packed)
  const drawText: string[] = []
  for (const [flag, label] of DRAW_LABELS) {
    if (!(draws & flag)) continue
    if (flag === DRAW.FlushDraw && draws & DRAW.NutFlushDraw) continue
    drawText.push(label)
  }
  const head = kicker ? `${made} (${kicker})` : made
  return drawText.length ? `${head} · ${drawText.join(', ')}` : head
}

/** Equity → background color on a red-amber-green scale. */
export function equityColor(eq: number): string {
  if (!Number.isFinite(eq)) return 'transparent'
  const hue = Math.round(eq * 120)
  return `hsl(${hue} 70% 50% / 0.55)`
}

/** Signed delta → color: red for negative, green for positive. */
export function deltaColor(delta: number, scale = 0.25): string {
  if (!Number.isFinite(delta)) return 'transparent'
  const t = Math.max(-1, Math.min(1, delta / scale))
  return t >= 0 ? `hsl(140 65% 42% / ${0.12 + t * 0.6})` : `hsl(0 70% 50% / ${0.12 - t * 0.6})`
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
