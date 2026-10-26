import { useEffect, useRef, useState } from 'react'
import {
  CLASS_COMBOS,
  NUM_COMBOS,
  type RangeParseError,
  className,
  comboConflicts,
  comboHigh,
  comboLow,
  createRange,
  formatRange,
  fullRange,
  parseRange,
  rangePercent,
  rangesEqual,
  topPercentRange,
} from '../../../engine/index.ts'
import { useActiveView } from '../../hooks/useView.ts'
import { actions, useStore } from '../../state/store.ts'
import { cardLabel, copyText, describeClassification, formatCombos } from '../../format.ts'
import { RangeMatrix } from '../RangeMatrix/RangeMatrix.tsx'
import styles from './RangeEditor.module.css'

export function RangeEditor() {
  const view = useActiveView()
  const range = view.player.range
  let total = 0
  for (let i = 0; i < NUM_COMBOS; i++) total += view.weights[i]!

  return (
    <section className={`panel ${styles.editor}`} aria-label="Range editor">
      <div className="row">
        <h2>
          <span className={styles.dot} style={{ background: view.player.color }} />
          {view.player.name}
        </h2>
        <span className="spacer" />
        <span className="muted" data-testid="range-summary">
          {formatCombos(total)} combos · {((total / NUM_COMBOS) * 100).toFixed(1)}%
          {view.street ? ` on the ${view.street.street}` : ''}
        </span>
      </div>
      <RangeMatrix />
      <BrushAndActions range={range} />
      <ComboSuitPicker />
      <TopPercentSlider range={range} />
      <RangeTextInput range={range} />
    </section>
  )
}

function BrushAndActions({ range }: { range: Float32Array }) {
  const brush = useStore((s) => s.prefs.brushWeight)
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (format: 'compact' | 'solver') => {
    if (await copyText(formatRange(range, format))) {
      setCopied(format)
      setTimeout(() => setCopied(null), 1200)
    }
  }
  return (
    <div className="row">
      <label className="row" title="Weight applied when painting the matrix">
        Brush
        <input
          type="range"
          min={0.05}
          max={1}
          step={0.05}
          value={brush}
          onChange={(e) => actions.setPrefs({ brushWeight: Number(e.target.value) })}
          aria-label="Brush weight"
        />
        <span className="mono">{Math.round(brush * 100)}%</span>
      </label>
      <span className="spacer" />
      <button type="button" onClick={() => actions.setRange(createRange())}>
        Clear
      </button>
      <button type="button" onClick={() => actions.setRange(fullRange())}>
        All
      </button>
      <button type="button" onClick={() => copy('compact')} title="Copy range text">
        {copied === 'compact' ? 'Copied' : 'Copy'}
      </button>
      <button
        type="button"
        onClick={() => copy('solver')}
        title="Copy in GTO+ / PioSolver format (AA:1,AKs:0.5)"
      >
        {copied === 'solver' ? 'Copied' : 'Copy for solver'}
      </button>
    </div>
  )
}

function ComboSuitPicker() {
  const cls = useStore((s) => s.selectedClass)
  const brush = useStore((s) => s.prefs.brushWeight)
  const view = useActiveView()
  if (cls === null) {
    return <p className={`muted ${styles.hint}`}>Click a cell to pick individual suits.</p>
  }
  const range = view.player.range
  const combos = CLASS_COMBOS[cls]!
  const setCombos = (weight: number) => {
    const next = new Float32Array(range)
    for (const i of combos) next[i] = weight
    actions.setRange(next)
  }
  return (
    <div className={styles.suits} aria-label={`Combos of ${className(cls)}`}>
      <div className="row">
        <strong>{className(cls)}</strong>
        <span className="spacer" />
        <button type="button" className="ghost" onClick={() => setCombos(brush)}>
          All suits
        </button>
        <button type="button" className="ghost" onClick={() => setCombos(0)}>
          None
        </button>
      </div>
      <div className={styles.comboGrid}>
        {combos.map((i) => {
          const blocked = comboConflicts(i, view.blocked)
          const w = range[i]!
          const packed = view.street?.stats.classes[i] ?? -1
          const hint =
            packed >= 0
              ? describeClassification(packed)
              : blocked
                ? 'Blocked by the board or dead cards'
                : ''
          return (
            <button
              key={i}
              type="button"
              className={styles.combo}
              aria-pressed={w > 0}
              disabled={blocked}
              title={hint}
              onClick={() => {
                const next = new Float32Array(range)
                next[i] = w > 0 ? 0 : brush
                actions.setRange(next)
              }}
            >
              {[comboHigh(i), comboLow(i)].map((c) => {
                const l = cardLabel(c)
                return (
                  <span key={c} style={{ color: w > 0 ? undefined : l.color }}>
                    {l.rank}
                    {l.suit}
                  </span>
                )
              })}
              {w > 0 && w < 1 ? <small> {Math.round(w * 100)}%</small> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TopPercentSlider({ range }: { range: Float32Array }) {
  const pct = rangePercent(range)
  return (
    <label className="row">
      Top
      <input
        type="range"
        min={0}
        max={100}
        step={0.5}
        value={Math.round(pct * 2) / 2}
        onChange={(e) => actions.setRange(topPercentRange(Number(e.target.value)))}
        className={styles.slider}
        aria-label="Top percent of hands"
      />
      <span className="mono">{pct.toFixed(1)}%</span>
    </label>
  )
}

function RangeTextInput({ range }: { range: Float32Array }) {
  const [text, setText] = useState(() => formatRange(range))
  const [errors, setErrors] = useState<RangeParseError[]>([])
  const focused = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Follow outside changes (matrix, slider, undo) unless the user is typing.
  useEffect(() => {
    if (!focused.current) {
      setText(formatRange(range))
      setErrors([])
    }
  }, [range])

  const apply = (value: string) => {
    const result = parseRange(value)
    setErrors(result.errors)
    if (result.errors.length === 0 && !rangesEqual(result.range, currentActiveRange()))
      actions.setRange(result.range)
  }

  return (
    <div className={styles.textBox}>
      <label htmlFor="range-text" className="muted">
        Range text
      </label>
      <textarea
        id="range-text"
        rows={3}
        spellCheck={false}
        value={text}
        data-testid="range-text"
        aria-invalid={errors.length > 0}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false
          if (errors.length === 0) setText(formatRange(currentActiveRange()))
        }}
        onChange={(e) => {
          const value = e.target.value
          setText(value)
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => apply(value), 150)
        }}
        placeholder="e.g. QQ+, AKs, A5s-A2s, KQo, [50]JJ-99[/50]"
      />
      {errors.length > 0 && (
        <ul className={`error ${styles.errors}`} role="alert">
          {errors.slice(0, 3).map((e, k) => (
            <li key={k}>
              {e.message}
              {e.end > e.start ? ` (“${text.slice(e.start, e.end)}”)` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function currentActiveRange(): Float32Array {
  const s = useStore.getState()
  return (s.players.find((p) => p.id === s.activeId) ?? s.players[0]!).range
}
