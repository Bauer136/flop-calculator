import type { ReactNode } from 'react'
import {
  BUILTIN_STATS,
  type Card,
  RANK_CHARS,
  type Street,
  customStatId,
  makeCard,
} from '../../../engine/index.ts'
import { useStore } from '../../state/store.ts'
import { SUIT_SYMBOLS, suitVar } from '../../format.ts'
import styles from './Tabs.module.css'

/** 4 × 13 grid of cards (suits by rank) with a value and background per card. */
export function CardGrid(props: {
  cell: (card: Card) => { text: string; background: string; title: string } | null
  label: string
}) {
  return (
    <div className={styles.cardGrid} role="table" aria-label={props.label}>
      {[3, 2, 1, 0].map((suit) => (
        <div key={suit} role="row" className={styles.cardGridRow}>
          {Array.from({ length: 13 }, (_, k) => {
            const card = makeCard(12 - k, suit)
            const c = props.cell(card)
            return (
              <div
                key={card}
                role="cell"
                className={`${styles.cardGridCell} ${c ? '' : styles.cardGridEmpty}`}
                style={{ background: c?.background }}
                title={c?.title}
              >
                <span className={styles.cardGridName} style={{ color: suitVar(suit) }}>
                  {RANK_CHARS.charAt(12 - k)}
                  {SUIT_SYMBOLS[suit]}
                </span>
                <span className={styles.cardGridValue}>{c?.text ?? ''}</span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** Dropdown of built-in stats available on `street` plus custom stats. */
export function StatSelect(props: {
  value: string
  onChange: (id: string) => void
  street?: Street
  label?: string
}) {
  const customStats = useStore((s) => s.customStats)
  return (
    <select
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      aria-label={props.label ?? 'Stat'}
    >
      <optgroup label="Made hands">
        {BUILTIN_STATS.filter(
          (s) => s.section === 'made' && (!props.street || s.streets.includes(props.street)),
        ).map((s) => (
          <option key={s.id} value={s.id}>
            {s.depth ? `  ${s.label}` : s.label}
          </option>
        ))}
      </optgroup>
      <optgroup label="Draws">
        {BUILTIN_STATS.filter(
          (s) => s.section === 'draws' && (!props.street || s.streets.includes(props.street)),
        ).map((s) => (
          <option key={s.id} value={s.id}>
            {s.depth ? `  ${s.label}` : s.label}
          </option>
        ))}
      </optgroup>
      {customStats.length > 0 && (
        <optgroup label="Custom">
          {customStats.map((c) => (
            <option key={c.id} value={customStatId(c.id)}>
              {c.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  )
}

export function JobStatus(props: {
  running: boolean
  progress: number
  error: string | null
  children?: ReactNode
}) {
  return (
    <div className={styles.status}>
      {props.running && (
        <div
          className="progress"
          role="progressbar"
          aria-valuenow={Math.round(props.progress * 100)}
        >
          <span style={{ width: `${Math.max(3, props.progress * 100)}%` }} />
        </div>
      )}
      {props.error && (
        <p className="error" role="alert">
          {props.error}
        </p>
      )}
      {props.children}
    </div>
  )
}
