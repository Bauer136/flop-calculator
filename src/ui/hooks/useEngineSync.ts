import { useEffect, useMemo, useRef } from 'react'
import {
  type EquityProgress,
  STREET_BOARD_LENGTH,
  type Street,
  fullRange,
  rangeSubtract,
  topPercentRange,
} from '../../engine/index.ts'
import type { PlayerAnalysis } from '../../worker/api.ts'
import { SupersededError, channels, fastEngine, proxy } from '../../worker/client.ts'
import { type JobState, type ResultsState, idle, useResults } from '../state/results.ts'
import { type ViewStreet, useStore } from '../state/store.ts'

const HEAVY_DEBOUNCE_MS = 150

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

type JobKey = 'nextCard' | 'equity' | 'hotness' | 'preflop'

function patchJob<K extends JobKey>(
  key: K,
  patch: Partial<JobState<NonNullable<ResultsState[K]['data']>>>,
): void {
  useResults.setState((s) => ({ [key]: { ...s[key], ...patch } }) as Partial<ResultsState>)
}

/** Each player's range at the viewed street, after that street's filters. */
export function rangesAtView(analysis: PlayerAnalysis[], view: ViewStreet): Float32Array[] {
  return analysis.map((a) => {
    if (view === 'preflop') return a.preflop
    return a.streets.find((s) => s.street === view)?.rangeOut ?? a.preflop
  })
}

/** Content hash of a set of ranges, so identical recomputed ranges don't restart heavy jobs. */
function rangesKey(ranges: readonly Float32Array[]): string {
  return ranges
    .map((r) => {
      const words = new Uint32Array(r.buffer, r.byteOffset, r.length)
      let h = 0x811c9dc5
      for (let i = 0; i < words.length; i++) h = Math.imul(h ^ words[i]!, 0x01000193)
      return (h >>> 0).toString(36)
    })
    .join('.')
}

/** Bunching: each folded player holds a hand outside the top `topPercent`. */
function foldedRangesFor(players: number, topPercent: number): Float32Array[] {
  if (players <= 0) return []
  const fold = rangeSubtract(fullRange(), topPercentRange(topPercent))
  return Array.from({ length: players }, () => fold)
}

export function boardAtView(board: readonly number[], view: ViewStreet): number[] {
  return view === 'preflop' ? [] : board.slice(0, STREET_BOARD_LENGTH[view as Street])
}

/** Dispatches engine jobs whenever their inputs change. Mount once, in App. */
export function useEngineSync(): void {
  const players = useStore((s) => s.players)
  const board = useStore((s) => s.board)
  const dead = useStore((s) => s.dead)
  const groups = useStore((s) => s.groups)
  const customStats = useStore((s) => s.customStats)
  const view = useStore((s) => s.view)
  const activeId = useStore((s) => s.activeId)
  const forceMonteCarlo = useStore((s) => s.prefs.forceMonteCarlo)
  const foldedPlayers = useStore((s) => s.prefs.foldedPlayers)
  const foldedTopPercent = useStore((s) => s.prefs.foldedTopPercent)
  const tab = useResults((s) => s.tab)
  const analysis = useResults((s) => s.analysis)
  const equityData = useResults((s) => s.equity.data)

  const usesEquity = useMemo(
    () =>
      JSON.stringify(groups).includes('"equity"') ||
      JSON.stringify(customStats).includes('"equity"'),
    [groups, customStats],
  )

  // Fast analysis: every change, latest request wins.
  const analyzeId = useRef(0)
  useEffect(() => {
    const id = ++analyzeId.current
    const equityByPlayer =
      usesEquity && equityData && view !== 'preflop'
        ? players.map((_, p) => equityData.comboEquity[p] ?? null)
        : undefined
    fastEngine()
      .analyze({
        players: players.map((p) => ({ range: p.range, filters: p.filters })),
        board,
        dead,
        customStats,
        groups,
        equity: equityByPlayer,
        equityStreet: view,
      })
      .then(
        (result) => {
          if (id === analyzeId.current)
            useResults.setState({ analysis: result, analysisError: null })
        },
        (e: unknown) => {
          if (id === analyzeId.current) useResults.setState({ analysisError: errorMessage(e) })
        },
      )
  }, [players, board, dead, groups, customStats, usesEquity, equityData, view])

  const activeIndex = Math.max(
    0,
    players.findIndex((p) => p.id === activeId),
  )
  const ready = analysis && analysis.length === players.length ? analysis : null
  // Equity conditions only feed groups (never filters), so these ranges never depend on equity.
  const computed = ready ? rangesAtView(ready, view) : null
  const key = computed ? rangesKey(computed) : ''
  // Keyed by content, not array identity, so recomputed-but-identical ranges don't restart
  // heavy jobs.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  const ranges = useMemo(() => computed, [key])
  const viewBoard = useMemo(() => boardAtView(board, view), [board, view])

  // Next card (fast worker): only while its tab is open.
  const nextId = useRef(0)
  useEffect(() => {
    if (tab !== 'nextCard' || !ranges || (viewBoard.length !== 3 && viewBoard.length !== 4)) {
      patchJob('nextCard', idle())
      return
    }
    const id = ++nextId.current
    patchJob('nextCard', { running: true, error: null })
    fastEngine()
      .nextCard({ weights: ranges[activeIndex]!, board: viewBoard, dead, customStats })
      .then(
        (data) => id === nextId.current && patchJob('nextCard', { data, running: false }),
        (e: unknown) =>
          id === nextId.current && patchJob('nextCard', { error: errorMessage(e), running: false }),
      )
  }, [tab, ranges, viewBoard, dead, customStats, activeIndex])

  // Equity (heavy): while the equity tab is open or an equity condition needs it.
  useEffect(() => {
    const wanted = tab === 'equity' || usesEquity
    if (!wanted || !ranges) return
    const timer = setTimeout(() => {
      patchJob('equity', { running: true, progress: 0, error: null })
      channels.equity
        .run((api) =>
          api.equity(
            {
              ranges,
              board: viewBoard,
              dead,
              monteCarlo: forceMonteCarlo,
              seed: 1,
              foldedRanges: foldedRangesFor(foldedPlayers, foldedTopPercent),
            },
            proxy((p: EquityProgress) => {
              useResults.setState((s) => ({ equity: { ...s.equity, progress: p.fraction } }))
            }),
          ),
        )
        .then(
          (data) => patchJob('equity', { data, running: false, progress: 1 }),
          (e: unknown) => {
            if (!(e instanceof SupersededError))
              patchJob('equity', { data: null, error: errorMessage(e), running: false })
          },
        )
    }, HEAVY_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [tab, usesEquity, ranges, viewBoard, dead, forceMonteCarlo, foldedPlayers, foldedTopPercent])

  // Hotness (heavy): heads-up on a flop or turn, while its tab is open.
  useEffect(() => {
    if (
      tab !== 'hotness' ||
      !ranges ||
      ranges.length !== 2 ||
      (viewBoard.length !== 3 && viewBoard.length !== 4)
    ) {
      channels.hotness.cancel()
      patchJob('hotness', idle())
      return
    }
    const timer = setTimeout(() => {
      patchJob('hotness', { running: true, progress: 0, error: null })
      const [hero, villain] =
        activeIndex === 1 ? [ranges[1]!, ranges[0]!] : [ranges[0]!, ranges[1]!]
      channels.hotness
        .run((api) =>
          api.hotness(
            { hero, villain, board: viewBoard, dead },
            proxy((fraction: number) =>
              useResults.setState((s) => ({ hotness: { ...s.hotness, progress: fraction } })),
            ),
          ),
        )
        .then(
          (data) => patchJob('hotness', { data, running: false, progress: 1 }),
          (e: unknown) => {
            if (!(e instanceof SupersededError))
              patchJob('hotness', { data: null, error: errorMessage(e), running: false })
          },
        )
    }, HEAVY_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [tab, ranges, viewBoard, dead, activeIndex])

  // Preflop stats / flop breakdown (heavy): active player's preflop range.
  const activeRange = players[activeIndex]?.range
  useEffect(() => {
    if ((tab !== 'preflopStats' && tab !== 'flopBreakdown') || !activeRange) return
    const timer = setTimeout(() => {
      patchJob('preflop', { running: true, progress: 0, error: null })
      channels.preflop
        .run((api) =>
          api.preflopStats(
            { range: activeRange, dead },
            proxy((fraction: number) =>
              useResults.setState((s) => ({ preflop: { ...s.preflop, progress: fraction } })),
            ),
          ),
        )
        .then(
          (data) => patchJob('preflop', { data, running: false, progress: 1 }),
          (e: unknown) => {
            if (!(e instanceof SupersededError))
              patchJob('preflop', { data: null, error: errorMessage(e), running: false })
          },
        )
    }, HEAVY_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [tab, activeRange, dead])
}
