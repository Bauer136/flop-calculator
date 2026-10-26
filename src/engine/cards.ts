/**
 * Card encoding: card = rank * 4 + suit.
 * rank: 0 = '2' … 8 = 'T' … 12 = 'A'; suit: 0 = c, 1 = d, 2 = h, 3 = s.
 */
export type Card = number

export const NUM_CARDS = 52
export const NUM_RANKS = 13
export const RANK_CHARS = '23456789TJQKA'
export const SUIT_CHARS = 'cdhs'
export const ACE = 12

export const rankOf = (card: Card): number => card >> 2
export const suitOf = (card: Card): number => card & 3
export const makeCard = (rank: number, suit: number): Card => rank * 4 + suit

/** Parses a single rank character ('A', 'k', 't', '9'…); returns -1 when invalid. */
export function parseRank(ch: string): number {
  return RANK_CHARS.indexOf(ch.toUpperCase())
}

/** Parses a single suit character ('h', 'S'…); returns -1 when invalid. */
export function parseSuit(ch: string): number {
  return SUIT_CHARS.indexOf(ch.toLowerCase())
}

/** Parses 'Ah', 'td', '10h'; returns -1 when invalid. */
export function tryParseCard(text: string): Card {
  const t = text.trim()
  let rankPart: string
  let suitPart: string
  if (t.length === 3 && t.startsWith('10')) {
    rankPart = 'T'
    suitPart = t.charAt(2)
  } else if (t.length === 2) {
    rankPart = t.charAt(0)
    suitPart = t.charAt(1)
  } else {
    return -1
  }
  const rank = parseRank(rankPart)
  const suit = parseSuit(suitPart)
  return rank < 0 || suit < 0 ? -1 : makeCard(rank, suit)
}

export function parseCard(text: string): Card {
  const card = tryParseCard(text)
  if (card < 0) throw new Error(`Invalid card "${text}"`)
  return card
}

export function formatRank(rank: number): string {
  return RANK_CHARS.charAt(rank)
}

export function formatCard(card: Card): string {
  return RANK_CHARS.charAt(rankOf(card)) + SUIT_CHARS.charAt(suitOf(card))
}

/**
 * Parses a card list such as "Ks7d2c", "Ks 7d 2c" or "Ks,7d,2c".
 * Throws on invalid or duplicate cards.
 */
export function parseCards(text: string): Card[] {
  const compact = text.replace(/[\s,]+/g, '').replace(/10/g, 'T')
  if (compact.length % 2 !== 0) throw new Error(`Invalid card list "${text}"`)
  const cards: Card[] = []
  for (let i = 0; i < compact.length; i += 2) {
    const card = parseCard(compact.slice(i, i + 2))
    if (cards.includes(card)) throw new Error(`Duplicate card ${formatCard(card)}`)
    cards.push(card)
  }
  return cards
}

export function formatCards(cards: readonly Card[], separator = ''): string {
  return cards.map(formatCard).join(separator)
}

/** 0/1 flags per card, for fast "is this card used" checks. */
export function cardSet(cards: readonly Card[]): Uint8Array {
  const set = new Uint8Array(NUM_CARDS)
  for (const c of cards) set[c] = 1
  return set
}

/** All cards not in `used`, ascending. */
export function remainingCards(used: readonly Card[]): Card[] {
  const set = cardSet(used)
  const out: Card[] = []
  for (let c = 0; c < NUM_CARDS; c++) if (!set[c]) out.push(c)
  return out
}
