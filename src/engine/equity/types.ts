export interface EquityResult {
  /** Equity per player (0..1); index 0 is the hero. Ties count as split pots. */
  players: number[]
  /** Per-combo equity for each player (NaN where the combo never played). */
  comboEquity: Float32Array[]
  /** Per-combo matchup weight for each player (how much each combo contributed). */
  comboWeight: Float32Array[]
  exact: boolean
  /** Monte Carlo only. */
  trials?: number
  /** Monte Carlo only: standard error of the hero's equity. */
  stdError?: number
}

export interface EquityProgress {
  /** 0..1 for exact jobs; trials / maxTrials for Monte Carlo. */
  fraction: number
  partial: EquityResult
}

export interface EquityOptions {
  onProgress?: (p: EquityProgress) => void
  /** Checked between chunks; return true to stop early with the partial result. */
  shouldStop?: () => boolean
}

/** Thrown when the players' ranges can't be dealt together (every matchup shares a card). */
export class NoMatchupsError extends Error {
  constructor() {
    super('The ranges have no matchups that can be dealt together')
    this.name = 'NoMatchupsError'
  }
}
