import { type KeyboardEvent, type PointerEvent, useMemo, useRef, useState } from 'react'
import {
  CLASS_COMBOS,
  NUM_CLASSES,
  anyOfStats,
  classKind,
  className,
  classWeight,
  comboConflicts,
  compileCondition,
  setClassWeight,
} from '../../../engine/index.ts'
import { useActiveView } from '../../hooks/useView.ts'
import { actions, useStore } from '../../state/store.ts'
import { formatCombos } from '../../format.ts'
import styles from './RangeMatrix.module.css'

interface CellInfo {
  live: number
  weight: number
  highlight: number
  groups: number[]
}

const KIND_BG = {
  pair: 'var(--cell-pair)',
  suited: 'var(--cell-suited)',
  offsuit: 'var(--cell-offsuit)',
}

function cellBackground(cls: number, c: CellInfo, groupColors: string[] | null): string {
  const base = KIND_BG[classKind(cls)]
  if (c.live === 0) return `var(--cell-blocked), ${base}`
  const fill = (c.weight / c.live) * 100
  if (fill <= 0) return base
  if (groupColors) {
    const stops: string[] = []
    let at = 0
    c.groups.forEach((w, g) => {
      if (w <= 0) return
      const next = at + (w / c.live) * 100
      stops.push(`${groupColors[g]} ${at}% ${next}%`)
      at = next
    })
    if (at < fill) stops.push(`var(--range-fill) ${at}% ${fill}%`)
    stops.push(`transparent ${fill}%`)
    return `linear-gradient(to right, ${stops.join(', ')}), ${base}`
  }
  if (c.highlight > 0) {
    const h = (c.highlight / c.live) * 100
    return `linear-gradient(to top, var(--highlight-fill) ${h}%, var(--range-fill) ${h}% ${fill}%, transparent ${fill}%), ${base}`
  }
  return `linear-gradient(to top, var(--range-fill) ${fill}%, transparent ${fill}%), ${base}`
}

export function RangeMatrix() {
  const view = useActiveView()
  const selectedStats = useStore((s) => s.selectedStats)
  const selectedClass = useStore((s) => s.selectedClass)
  const groups = useStore((s) => s.groups)
  const customStats = useStore((s) => s.customStats)
  const showGroups = useStore((s) => s.prefs.showGroups)
  const brush = useStore((s) => s.prefs.brushWeight)
  const painting = useRef<{ erase: boolean; last: number } | null>(null)
  const [focus, setFocus] = useState(0)

  const groupsActive = showGroups && groups.length > 0 && view.street !== null

  const cells = useMemo(() => {
    const { weights, blocked, street } = view
    const test =
      selectedStats.length > 0 && street
        ? compileCondition(anyOfStats(selectedStats), { customStats })
        : null
    const out: CellInfo[] = []
    for (let cls = 0; cls < NUM_CLASSES; cls++) {
      const c: CellInfo = {
        live: 0,
        weight: 0,
        highlight: 0,
        groups: new Array(groups.length).fill(0),
      }
      for (const i of CLASS_COMBOS[cls]!) {
        if (comboConflicts(i, blocked)) continue
        c.live++
        const w = weights[i]!
        c.weight += w
        if (w <= 0 || !street) continue
        const p = street.stats.classes[i]!
        if (test && p >= 0 && test(p, i)) c.highlight += w
        const g = street.groups.groupOf[i]!
        if (g >= 0) c.groups[g]! += w
      }
      out.push(c)
    }
    return out
  }, [view, selectedStats, customStats, groups.length])

  const groupColors = groupsActive ? groups.map((g) => g.color) : null

  const paintClass = (cls: number) => {
    const s = useStore.getState()
    const player = s.players.find((p) => p.id === s.activeId)!
    const range = new Float32Array(player.range)
    setClassWeight(range, cls, painting.current?.erase ? 0 : s.prefs.brushWeight)
    actions.paintRange(range)
  }

  const classAtPoint = (e: PointerEvent): number | null => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-cls]')
    return el ? Number(el.dataset.cls) : null
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const cls = classAtPoint(e)
    if (cls === null) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const range = view.player.range
    const erase = e.button === 2 || e.shiftKey || classWeight(range, cls) >= brush - 1e-6
    actions.selectClass(cls)
    setFocus(cls)
    actions.beginGesture()
    painting.current = { erase, last: cls }
    paintClass(cls)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!painting.current) return
    const cls = classAtPoint(e)
    if (cls === null || cls === painting.current.last) return
    painting.current.last = cls
    paintClass(cls)
  }

  const endPaint = () => {
    painting.current = null
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const row = Math.floor(focus / 13)
    const col = focus % 13
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    }
    const move = moves[e.key]
    if (move) {
      e.preventDefault()
      const next =
        Math.min(12, Math.max(0, row + move[0])) * 13 + Math.min(12, Math.max(0, col + move[1]))
      setFocus(next)
      actions.selectClass(next)
      document.querySelector<HTMLElement>(`[data-cls="${next}"]`)?.focus()
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      const range = new Float32Array(view.player.range)
      setClassWeight(range, focus, classWeight(range, focus) >= brush - 1e-6 ? 0 : brush)
      actions.setRange(range)
      actions.selectClass(focus)
    }
  }

  return (
    <div
      className={styles.grid}
      role="grid"
      aria-label="Starting hand matrix"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPaint}
      onPointerCancel={endPaint}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={onKeyDown}
      data-testid="range-matrix"
    >
      {cells.map((c, cls) => {
        const name = className(cls)
        const pct = c.live ? Math.round((c.weight / c.live) * 100) : 0
        return (
          <button
            key={cls}
            type="button"
            role="gridcell"
            data-cls={cls}
            tabIndex={cls === focus ? 0 : -1}
            className={`${styles.cell} ${cls === selectedClass ? styles.selected : ''}`}
            style={{ background: cellBackground(cls, c, groupColors) }}
            aria-label={`${name}: ${formatCombos(c.weight)} of ${c.live} combos`}
            aria-selected={c.weight > 0}
            title={`${name} · ${formatCombos(c.weight)}/${c.live} combos${pct && pct < 100 ? ` · ${pct}%` : ''}${
              c.highlight > 0 ? ` · ${formatCombos(c.highlight)} in selection` : ''
            }`}
          >
            {name}
          </button>
        )
      })}
    </div>
  )
}
