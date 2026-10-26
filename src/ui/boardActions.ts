import { remainingCards } from '../engine/index.ts'
import { actions, useStore } from './state/store.ts'

function randomCards(n: number, exclude: number[]): number[] {
  const pool = remainingCards(exclude)
  const out: number[] = []
  for (let k = 0; k < n && pool.length; k++)
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!)
  return out
}

export function randomFlop(): void {
  const { dead } = useStore.getState()
  actions.setBoard(randomCards(3, dead))
}

export function randomNextCard(): void {
  const { board, dead } = useStore.getState()
  if (board.length < 3) return randomFlop()
  if (board.length >= 5) return
  actions.setBoard([...board, ...randomCards(1, [...board, ...dead])])
}
