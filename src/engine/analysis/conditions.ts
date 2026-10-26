import { COMBO_CARDS, type ComboIndex } from '../combos.ts'
import { BUILTIN_STAT_BY_ID, type StatId } from '../categorize/categories.ts'

/** A boolean expression over a combo's classification, used by custom stats, filters and groups. */
export type Condition =
  | { type: 'stat'; stat: StatId }
  /** Hole cards contain at least `min` cards of `suit` (the "suits operator"). */
  | { type: 'suit'; suit: number; min: 1 | 2 }
  | { type: 'suited'; suited: boolean }
  /** Equity in [min, max] (0..1); never matches when equity is unknown. */
  | { type: 'equity'; min: number; max: number }
  | { type: 'and'; items: Condition[] }
  | { type: 'or'; items: Condition[] }
  | { type: 'not'; item: Condition }
  | { type: 'true' }

export interface CustomStat {
  id: string
  name: string
  condition: Condition
}

export interface ConditionContext {
  customStats?: readonly CustomStat[]
  /** Per-combo equity (0..1, NaN when unknown) for equity conditions. */
  equity?: ArrayLike<number>
}

export type ComboTest = (packed: number, combo: ComboIndex) => boolean

export const CUSTOM_PREFIX = 'custom.'
export const customStatId = (id: string): StatId => CUSTOM_PREFIX + id

const NEVER: ComboTest = () => false

/** Compiles a condition into a fast predicate. Unknown stats never match. */
export function compileCondition(condition: Condition, ctx: ConditionContext = {}): ComboTest {
  return compile(condition, ctx, new Set())
}

function compile(c: Condition, ctx: ConditionContext, resolving: Set<string>): ComboTest {
  switch (c.type) {
    case 'true':
      return () => true
    case 'stat': {
      const builtin = BUILTIN_STAT_BY_ID.get(c.stat)
      if (builtin) {
        const test = builtin.test
        return (packed) => test(packed)
      }
      if (c.stat.startsWith(CUSTOM_PREFIX)) {
        const id = c.stat.slice(CUSTOM_PREFIX.length)
        const custom = ctx.customStats?.find((s) => s.id === id)
        // A custom stat that references itself (directly or not) never matches.
        if (!custom || resolving.has(id)) return NEVER
        resolving.add(id)
        const inner = compile(custom.condition, ctx, resolving)
        resolving.delete(id)
        return inner
      }
      return NEVER
    }
    case 'suit': {
      const { suit, min } = c
      return (_p, combo) => {
        const n =
          ((COMBO_CARDS[combo * 2]! & 3) === suit ? 1 : 0) +
          ((COMBO_CARDS[combo * 2 + 1]! & 3) === suit ? 1 : 0)
        return n >= min
      }
    }
    case 'suited': {
      const want = c.suited
      return (_p, combo) =>
        ((COMBO_CARDS[combo * 2]! & 3) === (COMBO_CARDS[combo * 2 + 1]! & 3)) === want
    }
    case 'equity': {
      const eq = ctx.equity
      if (!eq) return NEVER
      const { min, max } = c
      return (_p, combo) => {
        const e = eq[combo]!
        return e >= min && e <= max
      }
    }
    case 'and': {
      const tests = c.items.map((i) => compile(i, ctx, resolving))
      return (p, combo) => tests.every((t) => t(p, combo))
    }
    case 'or': {
      const tests = c.items.map((i) => compile(i, ctx, resolving))
      return (p, combo) => tests.some((t) => t(p, combo))
    }
    case 'not': {
      const test = compile(c.item, ctx, resolving)
      return (p, combo) => !test(p, combo)
    }
  }
}

/** OR of the given stats (what a set of checked stat rows means). */
export function anyOfStats(stats: readonly StatId[]): Condition {
  return { type: 'or', items: stats.map((stat) => ({ type: 'stat', stat })) }
}

/** Human-readable description of a condition. */
export function describeCondition(c: Condition, ctx: ConditionContext = {}): string {
  const SUITS = ['♣', '♦', '♥', '♠']
  switch (c.type) {
    case 'true':
      return 'Any hand'
    case 'stat': {
      const b = BUILTIN_STAT_BY_ID.get(c.stat)
      if (b) return b.label
      const id = c.stat.slice(CUSTOM_PREFIX.length)
      return ctx.customStats?.find((s) => s.id === id)?.name ?? c.stat
    }
    case 'suit':
      return c.min === 2 ? `Two ${SUITS[c.suit]}` : `Has ${SUITS[c.suit]}`
    case 'suited':
      return c.suited ? 'Suited' : 'Offsuit'
    case 'equity':
      return `Equity ${Math.round(c.min * 100)}–${Math.round(c.max * 100)}%`
    case 'and':
      return c.items.map((i) => wrap(i, ctx)).join(' AND ')
    case 'or':
      return c.items.map((i) => wrap(i, ctx)).join(' OR ')
    case 'not':
      return `NOT ${wrap(c.item, ctx)}`
  }
}

function wrap(c: Condition, ctx: ConditionContext): string {
  const s = describeCondition(c, ctx)
  return (c.type === 'and' || c.type === 'or') && c.items.length > 1 ? `(${s})` : s
}
