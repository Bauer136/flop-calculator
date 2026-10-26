import { useState } from 'react'
import { type Street, formatCard } from '../../../engine/index.ts'
import { useResults } from '../../state/results.ts'
import { useStore } from '../../state/store.ts'
import { deltaColor, formatEquity, formatPercent } from '../../format.ts'
import { CardGrid, JobStatus, StatSelect } from './shared.tsx'
import styles from './Tabs.module.css'

const NEXT_STREET: Record<string, Street> = { flop: 'turn', turn: 'river' }

export function NextCardTab() {
  const view = useStore((s) => s.view)
  const selected = useStore((s) => s.selectedStats)
  const job = useResults((s) => s.nextCard)
  const [stat, setStat] = useState('made.topPair')
  const statId = stat
  const next = NEXT_STREET[view]

  if (!next)
    return (
      <p className="muted">Pick the flop or turn to see how each next card changes the range.</p>
    )
  const data = job.data
  const k = data ? data.statIds.indexOf(statId) : -1
  const values = new Map<number, number>()
  let max = 0
  let sum = 0
  if (data && k >= 0) {
    for (const r of data.rows) {
      const pct = r.total > 0 ? (r.counts[k]! / r.total) * 100 : 0
      values.set(r.card, pct)
      max = Math.max(max, pct)
      sum += pct
    }
  }
  const avg = values.size ? sum / values.size : 0

  return (
    <div className={styles.tab}>
      <div className="row">
        <span>How often the {view} range (after filters) has</span>
        <StatSelect value={statId} onChange={setStat} street={next} />
        {selected[0] && selected[0] !== statId && (
          <button type="button" className="ghost" onClick={() => setStat(selected[0]!)}>
            Use selected stat
          </button>
        )}
        <span>on the {next}</span>
        <span className="spacer" />
        {values.size > 0 && <span className="muted">Average {formatPercent(avg)}</span>}
      </div>
      <JobStatus running={job.running} progress={0.5} error={job.error} />
      {data && (
        <CardGrid
          label={`Share of range in stat per ${next} card`}
          cell={(card) => {
            const v = values.get(card)
            if (v === undefined) return null
            return {
              text: v.toFixed(1),
              background: `color-mix(in srgb, var(--highlight-fill) ${max > 0 ? Math.round((v / max) * 70) : 0}%, transparent)`,
              title: `${formatCard(card)}: ${formatPercent(v, 2)}`,
            }
          }}
        />
      )}
    </div>
  )
}

export function HotnessTab() {
  const view = useStore((s) => s.view)
  const players = useStore((s) => s.players)
  const activeId = useStore((s) => s.activeId)
  const job = useResults((s) => s.hotness)
  const next = NEXT_STREET[view]

  if (players.length !== 2)
    return (
      <p className="muted">Hotness compares exactly two players. Remove extra players to use it.</p>
    )
  if (!next)
    return <p className="muted">Pick the flop or turn to see which next cards help or hurt.</p>
  const hero = players.find((p) => p.id === activeId) ?? players[0]!
  const data = job.data
  const rows = data
    ? [...data.rows].filter((r) => Number.isFinite(r.equity)).sort((a, b) => b.delta - a.delta)
    : []

  return (
    <div className={styles.tab}>
      <div className="row">
        <span>
          {hero.name}&rsquo;s equity on each {next} card
          {data && (
            <>
              {' '}
              (now <strong>{formatEquity(data.baseEquity)}</strong>)
            </>
          )}
        </span>
      </div>
      <JobStatus running={job.running} progress={job.progress} error={job.error} />
      {data && (
        <>
          <CardGrid
            label={`Equity change per ${next} card`}
            cell={(card) => {
              const r = data.rows.find((x) => x.card === card)
              if (!r || !Number.isFinite(r.equity)) return null
              return {
                text: `${r.delta >= 0 ? '+' : ''}${(r.delta * 100).toFixed(1)}`,
                background: deltaColor(r.delta),
                title: `${formatCard(card)}: ${formatEquity(r.equity)} (${r.delta >= 0 ? '+' : ''}${(r.delta * 100).toFixed(2)} pts)`,
              }
            }}
          />
          <div className={styles.columns}>
            <div>
              <h3 className={styles.h3}>Best cards</h3>
              <ol className={styles.compactList}>
                {rows.slice(0, 5).map((r) => (
                  <li key={r.card}>
                    {formatCard(r.card)} · {formatEquity(r.equity)}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className={styles.h3}>Worst cards</h3>
              <ol className={styles.compactList}>
                {rows
                  .slice(-5)
                  .reverse()
                  .map((r) => (
                    <li key={r.card}>
                      {formatCard(r.card)} · {formatEquity(r.equity)}
                    </li>
                  ))}
              </ol>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
