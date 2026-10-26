import { create } from 'zustand'
import type { HotnessResult, NextCardResult, PreflopStatsResult } from '../../engine/index.ts'
import type { EquityResponse, PlayerAnalysis } from '../../worker/api.ts'

export type BottomTab =
  'nextCard' | 'equity' | 'hotness' | 'groups' | 'customStats' | 'preflopStats' | 'flopBreakdown'

export interface JobState<T> {
  data: T | null
  running: boolean
  progress: number
  error: string | null
}

export const idle = <T>(): JobState<T> => ({ data: null, running: false, progress: 0, error: null })

export interface ResultsState {
  /** Analysis per player, aligned with the store's players array. */
  analysis: PlayerAnalysis[] | null
  analysisError: string | null
  tab: BottomTab
  nextCard: JobState<NextCardResult>
  equity: JobState<EquityResponse>
  hotness: JobState<HotnessResult>
  preflop: JobState<PreflopStatsResult>
}

export const useResults = create<ResultsState>(() => ({
  analysis: null,
  analysisError: null,
  tab: 'equity',
  nextCard: idle(),
  equity: idle(),
  hotness: idle(),
  preflop: idle(),
}))

export const setTab = (tab: BottomTab): void => useResults.setState({ tab })
