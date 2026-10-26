import { useEffect } from 'react'
import { randomFlop, randomNextCard } from './boardActions.ts'
import { actions, useStore } from './state/store.ts'

export const HOTKEYS: { keys: string; action: string }[] = [
  { keys: 'Ctrl/⌘ + Z', action: 'Undo' },
  { keys: 'Ctrl/⌘ + Shift + Z, Ctrl + Y', action: 'Redo' },
  { keys: 'R', action: 'Random flop' },
  { keys: 'N', action: 'Random next card' },
  { keys: 'C', action: 'Clear the board' },
  { keys: '1 – 9', action: 'Switch player' },
  { keys: 'P / F / T / V', action: 'View preflop / flop / turn / river' },
  { keys: 'L', action: 'Open the range library' },
  { keys: 'Esc', action: 'Clear the stat selection' },
  { keys: '?', action: 'Show this help' },
  { keys: 'Arrows, Space', action: 'Move around the matrix and toggle a hand' },
]

function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

export function useHotkeys(handlers: { openLibrary: () => void; openHelp: () => void }): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Dialogs handle their own keys (Escape closes them).
      if (document.querySelector('dialog[open]')) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        if (typing(e.target)) return
        e.preventDefault()
        if (e.shiftKey) actions.redo()
        else actions.undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        if (typing(e.target)) return
        e.preventDefault()
        actions.redo()
        return
      }
      if (mod || e.altKey || typing(e.target)) return

      const s = useStore.getState()
      const views: Record<string, 'preflop' | 'flop' | 'turn' | 'river'> = {
        p: 'preflop',
        f: 'flop',
        t: 'turn',
        v: 'river',
      }
      const key = e.key.toLowerCase()
      if (key === 'r') randomFlop()
      else if (key === 'n') randomNextCard()
      else if (key === 'c') actions.setBoard([])
      else if (key === 'l') handlers.openLibrary()
      else if (e.key === '?') handlers.openHelp()
      else if (e.key === 'Escape') actions.clearSelection()
      else if (/^[1-9]$/.test(e.key)) {
        const p = s.players[Number(e.key) - 1]
        if (p) actions.setActive(p.id)
      } else if (views[key]) {
        const v = views[key]
        const needed = { preflop: 0, flop: 3, turn: 4, river: 5 }[v]
        if (s.board.length >= needed) actions.setView(v)
      } else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handlers])
}
