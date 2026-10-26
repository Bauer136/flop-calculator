import { useMemo } from 'react'
import { type Card, cardSet, removeCards } from '../../engine/index.ts'
import type { StreetAnalysis } from '../../worker/api.ts'
import { useResults } from '../state/results.ts'
import { type Player, activePlayer, useStore } from '../state/store.ts'
import { boardAtView } from './useEngineSync.ts'

export interface ActiveView {
  player: Player
  index: number
  /** Analysis of the viewed street (null preflop or while loading). */
  street: StreetAnalysis | null
  /** Weights shown in the matrix: the range entering the viewed street. */
  weights: Float32Array
  /** Board cards up to the viewed street plus dead cards. */
  blockedCards: Card[]
  blocked: Uint8Array
  viewBoard: Card[]
}

export function useActiveView(): ActiveView {
  const player = useStore(activePlayer)
  const players = useStore((s) => s.players)
  const board = useStore((s) => s.board)
  const dead = useStore((s) => s.dead)
  const view = useStore((s) => s.view)
  const analysis = useResults((s) => s.analysis)
  const index = Math.max(
    0,
    players.findIndex((p) => p.id === player.id),
  )

  return useMemo(() => {
    const viewBoard = boardAtView(board, view)
    const blockedCards = [...viewBoard, ...dead]
    const a = analysis && analysis.length === players.length ? analysis[index] : undefined
    const street = view === 'preflop' ? null : (a?.streets.find((s) => s.street === view) ?? null)
    // Before analysis arrives, fall back to the raw range so edits show instantly.
    const weights = street ? street.stats.weights : removeCards(player.range, blockedCards)
    return {
      player,
      index,
      street,
      weights,
      blockedCards,
      blocked: cardSet(blockedCards),
      viewBoard,
    }
  }, [player, players.length, index, board, dead, view, analysis])
}
