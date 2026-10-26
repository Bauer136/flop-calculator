import { type Card, NUM_CARDS, NUM_RANKS, RANK_CHARS, formatCard, rankOf, suitOf } from './cards.ts'

/**
 * A combo is a specific two-card starting hand (1,326 of them).
 * For cards a > b: index = a * (a - 1) / 2 + b.
 */
export type ComboIndex = number

/**
 * A hand class is one of the 169 matrix cells (AA, AKs, AKo…).
 * Matrix row/col run 0 = A … 12 = 2; class = row * 13 + col.
 * row === col → pair, row < col → suited (upper right), row > col → offsuit.
 */
export type HandClass = number

export const NUM_COMBOS = 1326
export const NUM_CLASSES = 169

export function comboIndex(c1: Card, c2: Card): ComboIndex {
  const a = c1 > c2 ? c1 : c2
  const b = c1 > c2 ? c2 : c1
  return (a * (a - 1)) / 2 + b
}

/** Flattened [high, low] cards per combo. */
export const COMBO_CARDS = new Uint8Array(NUM_COMBOS * 2)
/** combo index by [c1 * 52 + c2], -1 on the diagonal. */
export const COMBO_INDEX = new Int16Array(NUM_CARDS * NUM_CARDS).fill(-1)

for (let a = 1; a < NUM_CARDS; a++) {
  for (let b = 0; b < a; b++) {
    const i = comboIndex(a, b)
    COMBO_CARDS[i * 2] = a
    COMBO_CARDS[i * 2 + 1] = b
    COMBO_INDEX[a * NUM_CARDS + b] = i
    COMBO_INDEX[b * NUM_CARDS + a] = i
  }
}

export const comboHigh = (i: ComboIndex): Card => COMBO_CARDS[i * 2]!
export const comboLow = (i: ComboIndex): Card => COMBO_CARDS[i * 2 + 1]!

export const rankToRow = (rank: number): number => 12 - rank
export const rowToRank = (row: number): number => 12 - row
export const classAt = (row: number, col: number): HandClass => row * NUM_RANKS + col
export const classRow = (cls: HandClass): number => Math.floor(cls / NUM_RANKS)
export const classCol = (cls: HandClass): number => cls % NUM_RANKS

export type ClassKind = 'pair' | 'suited' | 'offsuit'

export function classKind(cls: HandClass): ClassKind {
  const row = classRow(cls)
  const col = classCol(cls)
  return row === col ? 'pair' : row < col ? 'suited' : 'offsuit'
}

/** Class for a pair of ranks plus suitedness (ranks in any order). */
export function classOfRanks(r1: number, r2: number, suited: boolean): HandClass {
  const hi = Math.max(r1, r2)
  const lo = Math.min(r1, r2)
  const hiRow = rankToRow(hi)
  const loRow = rankToRow(lo)
  if (hi === lo) return classAt(hiRow, hiRow)
  return suited ? classAt(hiRow, loRow) : classAt(loRow, hiRow)
}

export function classOfCards(c1: Card, c2: Card): HandClass {
  return classOfRanks(rankOf(c1), rankOf(c2), suitOf(c1) === suitOf(c2))
}

/** Higher and lower rank of a class. */
export function classRanks(cls: HandClass): [number, number] {
  const a = rowToRank(classRow(cls))
  const b = rowToRank(classCol(cls))
  return a >= b ? [a, b] : [b, a]
}

export const COMBO_CLASS = new Uint8Array(NUM_COMBOS)
export const CLASS_COMBOS: readonly (readonly ComboIndex[])[] = (() => {
  const lists: ComboIndex[][] = Array.from({ length: NUM_CLASSES }, () => [])
  for (let i = 0; i < NUM_COMBOS; i++) {
    const cls = classOfCards(comboHigh(i), comboLow(i))
    COMBO_CLASS[i] = cls
    lists[cls]!.push(i)
  }
  return lists
})()

export function className(cls: HandClass): string {
  const [hi, lo] = classRanks(cls)
  const kind = classKind(cls)
  const base = RANK_CHARS.charAt(hi) + RANK_CHARS.charAt(lo)
  return kind === 'pair' ? base : base + (kind === 'suited' ? 's' : 'o')
}

/** Combo as text, higher rank first ("AhKh", "Td9c"). */
export function formatCombo(i: ComboIndex): string {
  return formatCard(comboHigh(i)) + formatCard(comboLow(i))
}

/** Whether combo i uses any card flagged in `used` (a 52-length 0/1 array). */
export function comboConflicts(i: ComboIndex, used: Uint8Array): boolean {
  return used[COMBO_CARDS[i * 2]!] === 1 || used[COMBO_CARDS[i * 2 + 1]!] === 1
}

/** Whether two combos share a card. */
export function combosOverlap(i: ComboIndex, j: ComboIndex): boolean {
  const a = COMBO_CARDS[i * 2]
  const b = COMBO_CARDS[i * 2 + 1]
  const c = COMBO_CARDS[j * 2]
  const d = COMBO_CARDS[j * 2 + 1]
  return a === c || a === d || b === c || b === d
}
