import { RANK_CHARS, makeCard, parseRank, parseSuit } from './cards.ts'
import {
  CLASS_COMBOS,
  NUM_CLASSES,
  classOfRanks,
  className,
  comboIndex,
  formatCombo,
} from './combos.ts'
import { type Range, createRange, setClassWeight } from './range.ts'

export interface RangeParseError {
  message: string
  /** Offset of the offending token in the input text. */
  start: number
  end: number
}

export interface RangeParseResult {
  range: Range
  errors: RangeParseError[]
}

const R = '[2-9TJQKA]'
const ANY_RE = /^(random|any|full|all)$/i
const COMBO_RE = new RegExp(`^(${R})([cdhs])(${R})([cdhs])$`, 'i')
const PAIR_RE = new RegExp(`^(${R})\\1([+-])?$`, 'i')
const PAIR_SPAN_RE = new RegExp(`^(${R})\\1-(${R})\\2$`, 'i')
const NONPAIR_RE = new RegExp(`^(${R})(${R})([so])?([+-])?$`, 'i')
const NONPAIR_SPAN_RE = new RegExp(`^(${R})(${R})([so])?-(${R})(${R})([so])?$`, 'i')
const TAG_RE = /^\[\s*(\/?)\s*(\d+(?:\.\d+)?)\s*\]/

/** A parsed item: the classes or combos it covers. */
type Target = { classes: number[] } | { combos: number[] } | { error: string }

function nonPairClasses(hi: number, kickers: number[], suitedness: string | undefined): number[] {
  const out: number[] = []
  for (const k of kickers) {
    if (suitedness !== 'o') out.push(classOfRanks(hi, k, true))
    if (suitedness !== 's') out.push(classOfRanks(hi, k, false))
  }
  return out
}

function span(lo: number, hi: number): number[] {
  const out: number[] = []
  for (let r = lo; r <= hi; r++) out.push(r)
  return out
}

function parseItem(body: string): Target {
  if (ANY_RE.test(body)) return { classes: span(0, NUM_CLASSES - 1) }

  let m = COMBO_RE.exec(body)
  if (m) {
    const c1 = makeCard(parseRank(m[1]!), parseSuit(m[2]!))
    const c2 = makeCard(parseRank(m[3]!), parseSuit(m[4]!))
    if (c1 === c2) return { error: `"${body}" uses the same card twice` }
    return { combos: [comboIndex(c1, c2)] }
  }

  m = PAIR_RE.exec(body)
  if (m) {
    const r = parseRank(m[1]!)
    const ranks = m[2] === '+' ? span(r, 12) : m[2] === '-' ? span(0, r) : [r]
    return { classes: ranks.map((x) => classOfRanks(x, x, false)) }
  }

  m = PAIR_SPAN_RE.exec(body)
  if (m) {
    const a = parseRank(m[1]!)
    const b = parseRank(m[2]!)
    return { classes: span(Math.min(a, b), Math.max(a, b)).map((x) => classOfRanks(x, x, false)) }
  }

  m = NONPAIR_RE.exec(body)
  if (m) {
    const a = parseRank(m[1]!)
    const b = parseRank(m[2]!)
    if (a === b) return { error: `"${body}" is a pair; pairs take no suitedness` }
    const hi = Math.max(a, b)
    const lo = Math.min(a, b)
    const kickers = m[4] === '+' ? span(lo, hi - 1) : m[4] === '-' ? span(0, lo) : [lo]
    return { classes: nonPairClasses(hi, kickers, m[3]?.toLowerCase()) }
  }

  m = NONPAIR_SPAN_RE.exec(body)
  if (m) {
    const a1 = parseRank(m[1]!)
    const b1 = parseRank(m[2]!)
    const a2 = parseRank(m[4]!)
    const b2 = parseRank(m[5]!)
    const hi1 = Math.max(a1, b1)
    const hi2 = Math.max(a2, b2)
    const s1 = m[3]?.toLowerCase()
    const s2 = m[6]?.toLowerCase()
    if (hi1 !== hi2) return { error: `"${body}": both ends of a span need the same top card` }
    if (s1 !== s2) return { error: `"${body}": both ends of a span need the same suitedness` }
    if (a1 === b1 || a2 === b2) return { error: `"${body}" mixes pairs and non-pairs` }
    const lo1 = Math.min(a1, b1)
    const lo2 = Math.min(a2, b2)
    return { classes: nonPairClasses(hi1, span(Math.min(lo1, lo2), Math.max(lo1, lo2)), s1) }
  }

  return { error: `Unrecognized hand "${body}"` }
}

/** Parses "0.5", "50%", or a bare number > 1 as a percentage. Returns NaN when invalid. */
function parseWeight(text: string): number {
  const t = text.trim()
  const pct = t.endsWith('%')
  const n = Number(pct ? t.slice(0, -1) : t)
  if (!Number.isFinite(n) || n < 0) return NaN
  const w = pct || n > 1 ? n / 100 : n
  return w > 1 ? NaN : w
}

/**
 * Parses range text. Supported forms: AA, QQ+, 22-55, QQ-, AK, AKs, AKo, A2s+, A9s-,
 * K9s-K6s, AhKh, random; weights as "AKs:0.5", "AKs:50%" or "[50]AKs,AQs[/50]".
 * Separators are commas or whitespace. Later items override earlier ones.
 * Invalid tokens are reported and skipped.
 */
export function parseRange(text: string): RangeParseResult {
  const range = createRange()
  const errors: RangeParseError[] = []
  const blockWeights: number[] = []
  let pos = 0

  while (pos < text.length) {
    const ch = text.charAt(pos)
    if (ch === ',' || /\s/.test(ch)) {
      pos++
      continue
    }

    if (ch === '[') {
      const tag = TAG_RE.exec(text.slice(pos))
      if (!tag) {
        const end = text.indexOf(']', pos)
        const stop = end < 0 ? text.length : end + 1
        errors.push({ message: 'Invalid weight tag', start: pos, end: stop })
        pos = stop
        continue
      }
      const stop = pos + tag[0].length
      if (tag[1] === '/') {
        if (blockWeights.length === 0) {
          errors.push({
            message: 'Closing weight tag without an opening tag',
            start: pos,
            end: stop,
          })
        } else {
          blockWeights.pop()
        }
      } else {
        const w = Number(tag[2]) / 100
        if (w > 1) errors.push({ message: 'Weight above 100%', start: pos, end: stop })
        blockWeights.push(Math.min(1, w))
      }
      pos = stop
      continue
    }

    const start = pos
    while (pos < text.length && !/[\s,[]/.test(text.charAt(pos))) pos++
    const token = text.slice(start, pos)
    const colon = token.indexOf(':')
    const body = colon < 0 ? token : token.slice(0, colon)

    let weight = blockWeights.length > 0 ? blockWeights[blockWeights.length - 1]! : 1
    if (colon >= 0) {
      weight = parseWeight(token.slice(colon + 1))
      if (Number.isNaN(weight)) {
        errors.push({ message: `Invalid weight in "${token}"`, start, end: pos })
        continue
      }
    }

    const target = parseItem(body)
    if ('error' in target) {
      errors.push({ message: target.error, start, end: pos })
    } else if ('classes' in target) {
      for (const cls of target.classes) setClassWeight(range, cls, weight)
    } else {
      for (const combo of target.combos) range[combo] = weight
    }
  }

  if (blockWeights.length > 0) {
    errors.push({ message: 'Unclosed weight tag', start: text.length, end: text.length })
  }
  return { range, errors }
}

/** Like parseRange but throws on the first error. */
export function parseRangeStrict(text: string): Range {
  const { range, errors } = parseRange(text)
  if (errors.length > 0) throw new Error(errors[0]!.message)
  return range
}

export type RangeFormat = 'compact' | 'solver'

/** Weight bucket key: weights equal to 4 decimals are written together. */
const weightKey = (w: number): number => Math.round(w * 10000)

function formatDecimal(value: number, decimals: number): string {
  return String(Number(value.toFixed(decimals)))
}

interface Split {
  /** Classes whose combos all share one weight, keyed by weight. */
  classesByWeight: Map<number, number[]>
  /** Combos of classes with mixed weights, keyed by weight. */
  combosByWeight: Map<number, number[]>
}

function splitRange(range: Range): Split {
  const classesByWeight = new Map<number, number[]>()
  const combosByWeight = new Map<number, number[]>()
  const add = (map: Map<number, number[]>, key: number, value: number) => {
    const list = map.get(key)
    if (list) list.push(value)
    else map.set(key, [value])
  }
  for (const cls of displayOrder()) {
    const combos = CLASS_COMBOS[cls]!
    const key = weightKey(range[combos[0]!]!)
    if (combos.every((i) => weightKey(range[i]!) === key)) {
      if (key > 0) add(classesByWeight, key, cls)
      continue
    }
    for (const i of combos) {
      const k = weightKey(range[i]!)
      if (k > 0) add(combosByWeight, k, i)
    }
  }
  return { classesByWeight, combosByWeight }
}

let order: number[] | null = null
/** Pairs high→low, then suited by top card, then offsuit by top card. */
function displayOrder(): number[] {
  if (order) return order
  const pairs: number[] = []
  const suited: number[] = []
  const offsuit: number[] = []
  for (let hi = 12; hi >= 0; hi--) {
    pairs.push(classOfRanks(hi, hi, false))
    for (let lo = hi - 1; lo >= 0; lo--) {
      suited.push(classOfRanks(hi, lo, true))
      offsuit.push(classOfRanks(hi, lo, false))
    }
  }
  order = [...pairs, ...suited, ...offsuit]
  return order
}

/** Consecutive runs (ascending) of a sorted-ascending list. */
function runs(values: number[]): [number, number][] {
  const out: [number, number][] = []
  for (const v of values) {
    const last = out[out.length - 1]
    if (last && v === last[1] + 1) last[1] = v
    else out.push([v, v])
  }
  return out
}

/** Compresses a set of classes into tokens like "TT+", "A2s+", "K9o-K6o", "AK". */
function compressClasses(classes: number[]): string[] {
  const set = new Set(classes)
  const tokens: string[] = []
  const rc = (r: number) => RANK_CHARS.charAt(r)

  const pairRanks: number[] = []
  for (let r = 0; r <= 12; r++) if (set.has(classOfRanks(r, r, false))) pairRanks.push(r)
  for (const [lo, hi] of runs(pairRanks).reverse()) {
    const p = rc(lo) + rc(lo)
    if (lo === hi) tokens.push(p)
    else if (hi === 12) tokens.push(`${p}+`)
    else tokens.push(`${rc(hi)}${rc(hi)}-${p}`)
  }

  const kickerTokens = (hi: number, kickers: number[], suffix: string): string[] =>
    runs(kickers)
      .reverse()
      .map(([lo, top]) => {
        const h = rc(hi)
        if (lo === top) return `${h}${rc(lo)}${suffix}`
        if (top === hi - 1) return `${h}${rc(lo)}${suffix}+`
        return `${h}${rc(top)}${suffix}-${h}${rc(lo)}${suffix}`
      })

  const suitedTokens: string[] = []
  const offsuitTokens: string[] = []
  for (let hi = 12; hi >= 1; hi--) {
    const s: number[] = []
    const o: number[] = []
    for (let lo = 0; lo < hi; lo++) {
      if (set.has(classOfRanks(hi, lo, true))) s.push(lo)
      if (set.has(classOfRanks(hi, lo, false))) o.push(lo)
    }
    if (s.length > 0 && s.length === o.length && s.every((k, i) => k === o[i])) {
      suitedTokens.push(...kickerTokens(hi, s, ''))
      continue
    }
    suitedTokens.push(...kickerTokens(hi, s, 's'))
    offsuitTokens.push(...kickerTokens(hi, o, 'o'))
  }
  return [...tokens, ...suitedTokens, ...offsuitTokens]
}

/**
 * Serializes a range.
 * - compact: "QQ+,AKs,[50]A5s-A2s[/50]" (runs compressed, partial weights in percent blocks)
 * - solver:  "QQ,KK,AA,AKs,A5s:0.5" (one entry per class or combo, PioSolver/GTO+ style)
 */
export function formatRange(range: Range, format: RangeFormat = 'compact'): string {
  const { classesByWeight, combosByWeight } = splitRange(range)

  if (format === 'solver') {
    const parts: string[] = []
    const suffix = (key: number) => (key === 10000 ? '' : `:${formatDecimal(key / 10000, 4)}`)
    for (const cls of displayOrder()) {
      for (const [key, classes] of classesByWeight) {
        if (classes.includes(cls)) parts.push(className(cls) + suffix(key))
      }
    }
    for (const [key, combos] of combosByWeight) {
      for (const i of combos) parts.push(formatCombo(i) + suffix(key))
    }
    return parts.join(',')
  }

  const keys = [...new Set([...classesByWeight.keys(), ...combosByWeight.keys()])].sort(
    (a, b) => b - a,
  )
  const groups: string[] = []
  for (const key of keys) {
    const tokens = [
      ...compressClasses(classesByWeight.get(key) ?? []),
      ...(combosByWeight.get(key) ?? []).map(formatCombo),
    ]
    const body = tokens.join(',')
    groups.push(
      key === 10000
        ? body
        : `[${formatDecimal(key / 100, 2)}]${body}[/${formatDecimal(key / 100, 2)}]`,
    )
  }
  return groups.join(',')
}
