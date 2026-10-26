import type {
  Card,
  CustomStat,
  EquityMethod,
  EquityProgress,
  EquityRequest,
  EquityResult,
  Group,
  GroupAssignment,
  HotnessResult,
  NextCardResult,
  PreflopStatsResult,
  StatsResult,
  Street,
  StreetFilters,
} from '../engine/index.ts'

export interface PlayerInput {
  range: Float32Array
  filters: StreetFilters
}

export interface AnalyzeRequest {
  players: PlayerInput[]
  board: Card[]
  dead: Card[]
  customStats: CustomStat[]
  groups: Group[]
  /** Per-player, per-combo equity to evaluate equity conditions against (optional). */
  equity?: (Float32Array | null)[]
  /** Street the equity above belongs to. */
  equityStreet?: Street | 'preflop'
}

export interface StreetAnalysis {
  street: Street
  board: Card[]
  stats: StatsResult
  rangeOut: Float32Array
  groups: GroupAssignment
}

export interface PlayerAnalysis {
  preflop: Float32Array
  streets: StreetAnalysis[]
}

export interface NextCardRequest {
  weights: Float32Array
  board: Card[]
  dead: Card[]
  customStats: CustomStat[]
}

export interface HotnessRequest {
  hero: Float32Array
  villain: Float32Array
  board: Card[]
  dead: Card[]
}

export interface PreflopRequest {
  range: Float32Array
  dead: Card[]
}

export type EquityResponse = EquityResult & { method: EquityMethod }

export interface EngineApi {
  analyze(req: AnalyzeRequest): PlayerAnalysis[]
  nextCard(req: NextCardRequest): NextCardResult
  equity(req: EquityRequest, onProgress?: (p: EquityProgress) => void): EquityResponse
  hotness(req: HotnessRequest, onProgress?: (fraction: number) => void): HotnessResult
  preflopStats(req: PreflopRequest, onProgress?: (fraction: number) => void): PreflopStatsResult
}
