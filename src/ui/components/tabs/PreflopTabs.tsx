import { useState } from 'react'
import {
  BUILTIN_STATS,
  CONNECTIVITY,
  PAIRING,
  type PreflopStatsResult,
  RANK_CHARS,
  SUITEDNESS,
  TEXTURE_BUCKETS,
  decodeBucket,
  type FlopTexture,
} from '../../../engine/index.ts'
import { useResults } from '../../state/results.ts'
import { activePlayer, useStore } from '../../state/store.ts'
import { copyText, formatPercent } from '../../format.ts'
import { JobStatus } from './shared.tsx'
import styles from './Tabs.module.css'

interface Dimension {
  id: string
  label: string
  values: readonly string[]
  of: (t: FlopTexture) => number
}

const HIGH_LABELS = Array.from({ length: 13 }, (_, k) => `${RANK_CHARS.charAt(12 - k)}-high`)

const DIMENSIONS: Dimension[] = [
  { id: 'suitedness', label: 'Suits', values: SUITEDNESS, of: (t) => t.suitedness },
  { id: 'pairing', label: 'Pairing', values: PAIRING, of: (t) => t.pairing },
  { id: 'high', label: 'High card', values: HIGH_LABELS, of: (t) => 12 - t.high },
  { id: 'connected', label: 'Connectivity', values: CONNECTIVITY, of: (t) => t.connected },
]

/** Sums a per-bucket array into one value per dimension value. */
function byDimension(dim: Dimension, perBucket: (b: number) => number): number[] {
  const out = new Array<number>(dim.values.length).fill(0)
  for (let b = 0; b < TEXTURE_BUCKETS; b++) out[dim.of(decodeBucket(b))]! += perBucket(b)
  return out
}

function usePreflopJob() {
  const job = useResults((s) => s.preflop)
  const player = useStore(activePlayer)
  return { job, player }
}

export function PreflopStatsTab() {
  const { job, player } = usePreflopJob()
  const [dimId, setDimId] = useState('suitedness')
  const [conditional, setConditional] = useState(false)
  const data = job.data
  const dim = DIMENSIONS.find((d) => d.id === dimId)!

  return (
    <div className={styles.tab}>
      <div className="row">
        <span>How {player.name}&rsquo;s preflop range hits all 22,100 flops, split by</span>
        <select
          value={dimId}
          onChange={(e) => setDimId(e.target.value)}
          aria-label="Split flops by"
        >
          {DIMENSIONS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
        <div role="group" aria-label="Probability type" className="row">
          <button
            type="button"
            aria-pressed={!conditional}
            onClick={() => setConditional(false)}
            title="P(stat and flop type)"
          >
            Of all flops
          </button>
          <button
            type="button"
            aria-pressed={conditional}
            onClick={() => setConditional(true)}
            title="P(stat given flop type)"
          >
            Within flop type
          </button>
        </div>
        <span className="spacer" />
        {data && (
          <button type="button" onClick={() => void copyText(preflopText(data, dim, conditional))}>
            Copy
          </button>
        )}
      </div>
      <JobStatus running={job.running} progress={job.progress} error={job.error} />
      {data && data.total > 0 && <PreflopTable data={data} dim={dim} conditional={conditional} />}
      {data && data.total === 0 && <p className="muted">The range is empty.</p>}
    </div>
  )
}

function preflopRows(data: PreflopStatsResult, dim: Dimension, conditional: boolean) {
  const typeWeight = byDimension(dim, (b) => data.bucketWeight[b]!)
  return BUILTIN_STATS.map((stat, s) => {
    if (!stat.streets.includes('flop')) return null
    const per = byDimension(dim, (b) => data.statBucket[s * TEXTURE_BUCKETS + b]!)
    const overall = per.reduce((a, b) => a + b, 0) / data.total
    const cells = per.map((v, k) =>
      conditional ? (typeWeight[k]! > 0 ? v / typeWeight[k]! : 0) : v / data.total,
    )
    return { stat, overall, cells }
  }).filter((r) => r !== null)
}

function preflopText(data: PreflopStatsResult, dim: Dimension, conditional: boolean): string {
  const rows = preflopRows(data, dim, conditional)
  return [
    ['Stat', 'All flops', ...dim.values].join('\t'),
    ...rows.map((r) =>
      [
        r.stat.label,
        formatPercent(r.overall * 100, 3),
        ...r.cells.map((c) => formatPercent(c * 100, 3)),
      ].join('\t'),
    ),
  ].join('\n')
}

function PreflopTable({
  data,
  dim,
  conditional,
}: {
  data: PreflopStatsResult
  dim: Dimension
  conditional: boolean
}) {
  const rows = preflopRows(data, dim, conditional)
  return (
    <div className={styles.scroll}>
      <table className="data" data-testid="preflop-table">
        <thead>
          <tr>
            <th>Stat</th>
            <th>All flops</th>
            {dim.values.map((v) => (
              <th key={v}>{v}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.stat.id}>
              <td style={{ paddingLeft: 6 + r.stat.depth * 16 }}>{r.stat.label}</td>
              <td>
                <strong>{formatPercent(r.overall * 100, 2)}</strong>
              </td>
              {r.cells.map((c, k) => (
                <td key={k}>{formatPercent(c * 100, 2)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">
        {data.usedIsomorphism
          ? 'Computed over the 1,755 suit-distinct flops.'
          : `Computed over ${data.flopsEvaluated.toLocaleString()} flops.`}
      </p>
    </div>
  )
}

export function FlopBreakdownTab() {
  const { job, player } = usePreflopJob()
  const data = job.data
  return (
    <div className={styles.tab}>
      <p className="muted">
        How often each flop type comes when {player.name} holds a hand from their range (card
        removal included), and for a random deal.
      </p>
      <JobStatus running={job.running} progress={job.progress} error={job.error} />
      {data && data.total > 0 && (
        <div className={styles.breakdown}>
          {DIMENSIONS.map((dim) => {
            const withRange = byDimension(dim, (b) => data.bucketWeight[b]!)
            const raw = byDimension(dim, (b) => data.flopsPerBucket[b]!)
            const rawTotal = raw.reduce((a, b) => a + b, 0)
            return (
              <table key={dim.id} className="data" data-testid={`breakdown-${dim.id}`}>
                <thead>
                  <tr>
                    <th>{dim.label}</th>
                    <th>With range</th>
                    <th>Any hand</th>
                  </tr>
                </thead>
                <tbody>
                  {dim.values.map((v, k) => (
                    <tr key={v}>
                      <td>{v}</td>
                      <td>
                        <span
                          className={styles.inlineBar}
                          style={{ width: `${(withRange[k]! / data.total) * 60}px` }}
                        />
                        {formatPercent((withRange[k]! / data.total) * 100, 2)}
                      </td>
                      <td className="muted">
                        {formatPercent((raw[k]! / Math.max(rawTotal, 1)) * 100, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          })}
        </div>
      )}
    </div>
  )
}
