import type { Card } from '../cards.ts'
import { type Range, removeCards } from '../range.ts'
import type { ConditionContext } from './conditions.ts'
import { type FilterStep, applyFilters } from './filters.ts'
import { type StatsResult, computeStats } from './stats.ts'

export type Street = 'flop' | 'turn' | 'river'
export const STREETS: readonly Street[] = ['flop', 'turn', 'river']
export const STREET_BOARD_LENGTH: Record<Street, number> = { flop: 3, turn: 4, river: 5 }

export type StreetFilters = Record<Street, FilterStep[]>
export const emptyStreetFilters = (): StreetFilters => ({ flop: [], turn: [], river: [] })

export interface StreetResult {
  street: Street
  board: Card[]
  /** Range entering the street (previous filters applied, blocked combos removed). */
  stats: StatsResult
  /** Range after this street's filters: the input to the next street. */
  rangeOut: Float32Array
}

export interface PipelineResult {
  /** Preflop range with dead cards removed. */
  preflop: Float32Array
  streets: StreetResult[]
}

/** Streets available for a board of the given length. */
export function streetsFor(boardLength: number): Street[] {
  return STREETS.filter((s) => STREET_BOARD_LENGTH[s] <= boardLength)
}

/**
 * Runs the preflop → flop → turn → river pipeline: each street classifies the range
 * that survived the previous street's filters on that street's board.
 */
export function runStreets(
  range: Range,
  board: readonly Card[],
  dead: readonly Card[],
  filters: StreetFilters,
  ctx: ConditionContext = {},
): PipelineResult {
  const preflop = removeCards(range, dead)
  const streets: StreetResult[] = []
  let current: Float32Array = preflop
  for (const street of streetsFor(board.length)) {
    const streetBoard = board.slice(0, STREET_BOARD_LENGTH[street])
    const stats = computeStats(current, streetBoard, dead, ctx)
    const rangeOut = applyFilters(stats.weights, stats.classes, filters[street], ctx)
    streets.push({ street, board: streetBoard, stats, rangeOut })
    current = rangeOut
  }
  return { preflop, streets }
}
