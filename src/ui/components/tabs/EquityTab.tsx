import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CLASS_COMBOS, NUM_CLASSES, NUM_COMBOS, className } from '../../../engine/index.ts'
import type { EquityResponse } from '../../../worker/api.ts'
import { useResults } from '../../state/results.ts'
import { actions, useStore } from '../../state/store.ts'
import { copyText, equityColor, formatCombos, formatEquity } from '../../format.ts'
import { JobStatus } from './shared.tsx'
import styles from './Tabs.module.css'

const METHOD_LABELS: Record<EquityResponse['method'], string> = {
  'exact-hu': 'Exact (all runouts)',
  'exact-fixed': 'Exact (all boards)',
  'exact-3way': 'Exact 3-way (all runouts)',
  'monte-carlo': 'Monte Carlo',
}

export function EquityTab() {
  const job = useResults((s) => s.equity)
  const players = useStore((s) => s.players)
  const activeId = useStore((s) => s.activeId)
  const view = useStore((s) => s.view)
  const forceMC = useStore((s) => s.prefs.forceMonteCarlo)
  const foldedPlayers = useStore((s) => s.prefs.foldedPlayers)
  const foldedTopPercent = useStore((s) => s.prefs.foldedTopPercent)
  const [mode, setMode] = useState<'matrix' | 'graph' | 'table'>('matrix')
  const data = job.data
  const activeIndex = Math.max(
    0,
    players.findIndex((p) => p.id === activeId),
  )
  const stale = data && data.players.length !== players.length

  const summaryText = () =>
    data
      ? players.map((p, i) => `${p.name}\t${formatEquity(data.players[i] ?? NaN)}`).join('\n') +
        `\n(${METHOD_LABELS[data.method]}, ${view})`
      : ''

  return (
    <div className={styles.tab}>
      <div className="row">
        <span className="muted">
          Equity on the {view} using each player&rsquo;s range after filters.
        </span>
        <span className="spacer" />
        <label className="row">
          <input
            type="checkbox"
            checked={forceMC}
            onChange={(e) => actions.setPrefs({ forceMonteCarlo: e.target.checked })}
          />
          Monte Carlo only
        </label>
        <label className="row" title="Bunching effect: cards held by players who folded earlier">
          Folded players
          <select
            value={foldedPlayers}
            onChange={(e) => actions.setPrefs({ foldedPlayers: Number(e.target.value) })}
            aria-label="Folded players"
          >
            {Array.from({ length: 9 }, (_, n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {foldedPlayers > 0 && (
          <label className="row">
            folding all but the top
            <input
              type="number"
              min={0}
              max={95}
              step={5}
              value={foldedTopPercent}
              onChange={(e) => actions.setPrefs({ foldedTopPercent: Number(e.target.value) })}
              className={styles.num}
              aria-label="Folded players fold all but this top percent"
            />
            %
          </label>
        )}
      </div>
      <JobStatus running={job.running} progress={job.progress} error={job.error} />
      {data && !stale && (
        <>
          <table className="data" data-testid="equity-summary">
            <thead>
              <tr>
                <th>Player</th>
                <th>Equity</th>
                <th>Win share of pot</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => (
                <tr key={p.id} className={i === activeIndex ? styles.activeRow : ''}>
                  <td>
                    <span className={styles.dot} style={{ background: p.color }} />
                    {p.name}
                  </td>
                  <td className="mono" data-testid={`equity-${i}`}>
                    {formatEquity(data.players[i] ?? NaN)}
                  </td>
                  <td className={styles.barCell}>
                    <span
                      className={styles.bar}
                      style={{ width: `${(data.players[i] ?? 0) * 100}%`, background: p.color }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row">
            <span className="muted" data-testid="equity-method">
              {METHOD_LABELS[data.method]}
              {data.method === 'monte-carlo' &&
                ` · ${(data.trials ?? 0).toLocaleString()} trials · ±${((data.stdError ?? 0) * 100).toFixed(2)}%`}
            </span>
            <span className="spacer" />
            <button type="button" onClick={() => void copyText(summaryText())}>
              Copy
            </button>
            <div role="group" aria-label="Equity view" className="row">
              {(['matrix', 'graph', 'table'] as const).map((m) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
                  {m === 'matrix' ? 'Matrix' : m === 'graph' ? 'Graph' : 'Hands'}
                </button>
              ))}
            </div>
          </div>
          {mode === 'matrix' && <EquityMatrix data={data} player={activeIndex} />}
          {mode === 'graph' && <EquityGraph data={data} />}
          {mode === 'table' && <EquityHands data={data} player={activeIndex} />}
        </>
      )}
    </div>
  )
}

interface ClassEquity {
  cls: number
  equity: number
  combos: number
}

function classEquities(data: EquityResponse, player: number): ClassEquity[] {
  const eq = data.comboEquity[player]
  const w = data.comboWeight[player]
  if (!eq || !w) return []
  const out: ClassEquity[] = []
  for (let cls = 0; cls < NUM_CLASSES; cls++) {
    let num = 0
    let den = 0
    let combos = 0
    for (const i of CLASS_COMBOS[cls]!) {
      const e = eq[i]!
      if (!Number.isFinite(e) || w[i]! <= 0) continue
      num += e * w[i]!
      den += w[i]!
      combos++
    }
    if (den > 0) out.push({ cls, equity: num / den, combos })
  }
  return out
}

function EquityMatrix({ data, player }: { data: EquityResponse; player: number }) {
  const byClass = useMemo(
    () => new Map(classEquities(data, player).map((c) => [c.cls, c])),
    [data, player],
  )
  return (
    <div
      className={styles.eqMatrix}
      role="table"
      aria-label="Equity by starting hand"
      data-testid="equity-matrix"
    >
      {Array.from({ length: NUM_CLASSES }, (_, cls) => {
        const c = byClass.get(cls)
        return (
          <div
            key={cls}
            role="cell"
            className={styles.eqCell}
            style={{ background: c ? equityColor(c.equity) : undefined }}
            title={
              c
                ? `${className(cls)}: ${formatEquity(c.equity)} (${c.combos} combos)`
                : className(cls)
            }
          >
            <span className={styles.eqName}>{className(cls)}</span>
            {c && <span className={styles.eqValue}>{Math.round(c.equity * 100)}</span>}
          </div>
        )
      })}
    </div>
  )
}

/** Combos sorted by equity: x = cumulative share of the range, y = equity. */
function EquityGraph({ data }: { data: EquityResponse }) {
  const players = useStore((s) => s.players)
  const series = useMemo(
    () =>
      data.comboEquity.map((eq, p) => {
        const w = data.comboWeight[p]!
        const items: { e: number; w: number }[] = []
        let total = 0
        for (let i = 0; i < NUM_COMBOS; i++) {
          if (Number.isFinite(eq[i]!) && w[i]! > 0) {
            items.push({ e: eq[i]!, w: w[i]! })
            total += w[i]!
          }
        }
        items.sort((a, b) => b.e - a.e)
        const points: { x: number; y: number }[] = []
        let acc = 0
        const step = Math.max(1, Math.floor(items.length / 200))
        items.forEach((it, k) => {
          acc += it.w
          if (k % step === 0 || k === items.length - 1)
            points.push({ x: (acc / total) * 100, y: it.e * 100 })
        })
        return points
      }),
    [data],
  )
  return (
    <div className={styles.chart} data-testid="equity-graph">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, 100]}
            unit="%"
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            label={{
              value: 'Share of range',
              position: 'insideBottom',
              offset: -4,
              fill: 'var(--text-muted)',
              fontSize: 12,
            }}
          />
          <YAxis
            type="number"
            domain={[0, 100]}
            unit="%"
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
          />
          <Tooltip
            formatter={(v) => `${Number(v).toFixed(1)}%`}
            labelFormatter={(x) => `Top ${Number(x).toFixed(1)}% of range`}
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          />
          {series.map((points, p) => (
            <Line
              key={p}
              data={points}
              dataKey="y"
              name={players[p]?.name ?? `Player ${p + 1}`}
              stroke={players[p]?.color ?? 'var(--accent)'}
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function EquityHands({ data, player }: { data: EquityResponse; player: number }) {
  const rows = useMemo(
    () => classEquities(data, player).sort((a, b) => b.equity - a.equity),
    [data, player],
  )
  return (
    <div className={styles.scroll}>
      <table className="data">
        <thead>
          <tr>
            <th>Hand</th>
            <th>Combos</th>
            <th>Equity</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cls}>
              <td>{className(r.cls)}</td>
              <td>{formatCombos(r.combos)}</td>
              <td style={{ background: equityColor(r.equity) }}>{formatEquity(r.equity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
