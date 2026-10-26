import { useMemo, useState } from 'react'
import {
  BUILTIN_STAT_BY_ID,
  CLASS_COMBOS,
  COMBO_CLASS,
  NUM_CLASSES,
  type StatRow,
  STREETS,
  type Street,
  anyOfStats,
  className,
  compileCondition,
  describeCondition,
  streetsFor,
} from '../../../engine/index.ts'
import { useActiveView } from '../../hooks/useView.ts'
import { actions, newId, useStore } from '../../state/store.ts'
import { CardFace } from '../Card/Card.tsx'
import { copyText, formatCombos, formatPercent } from '../../format.ts'
import styles from './StatsPanel.module.css'

export function StatsPanel() {
  const view = useActiveView()
  const viewStreet = useStore((s) => s.view)
  const units = useStore((s) => s.prefs.units)
  const selected = useStore((s) => s.selectedStats)
  const customStats = useStore((s) => s.customStats)
  const [hovered, setHovered] = useState<string | null>(null)
  const street = view.street

  const rows = useMemo(() => {
    if (!street) return []
    return street.stats.rows.filter((r) => {
      const def = BUILTIN_STAT_BY_ID.get(r.id)
      return !def || def.streets.includes(street.street)
    })
  }, [street])

  const selection = useMemo(() => {
    if (!street || selected.length === 0) return null
    const ctx = { customStats }
    const any = compileCondition(anyOfStats(selected), ctx)
    const all = compileCondition(
      { type: 'and', items: selected.map((stat) => ({ type: 'stat', stat })) },
      ctx,
    )
    let union = 0
    let overlap = 0
    street.stats.classes.forEach((p, i) => {
      const w = street.stats.weights[i]!
      if (p < 0 || w <= 0) return
      if (any(p, i)) union += w
      if (all(p, i)) overlap += w
    })
    return { union, overlap }
  }, [street, selected, customStats])

  const value = (r: StatRow) =>
    units === 'combos' ? formatCombos(r.combos) : formatPercent(r.percent)

  const copyStats = () => {
    if (!street) return
    const lines = [
      `Stat\tCombos\tPercent`,
      ...rows.map(
        (r) =>
          `${'  '.repeat(r.depth)}${r.label}\t${formatCombos(r.combos)}\t${r.percent.toFixed(2)}%`,
      ),
    ]
    void copyText(lines.join('\n'))
  }

  return (
    <section className={`panel ${styles.panel}`} aria-label="Statistics">
      <StreetTimeline />
      {!street ? (
        <p className="muted" data-testid="stats-empty">
          {viewStreet === 'preflop'
            ? 'Add a flop to see how the range hits it. Preflop stats over all flops are in the Preflop stats tab.'
            : 'Calculating…'}
        </p>
      ) : (
        <>
          <div className="row">
            <span>
              <strong>{formatCombos(street.stats.total)}</strong> combos on{' '}
              <span className={styles.inlineBoard}>
                {street.board.map((c) => (
                  <CardFace key={c} card={c} size="sm" />
                ))}
              </span>
            </span>
            <span className="spacer" />
            <div role="group" aria-label="Units" className="row">
              <button
                type="button"
                aria-pressed={units === 'combos'}
                onClick={() => actions.setPrefs({ units: 'combos' })}
              >
                Combos
              </button>
              <button
                type="button"
                aria-pressed={units === 'percent'}
                onClick={() => actions.setPrefs({ units: 'percent' })}
              >
                %
              </button>
            </div>
            <button type="button" onClick={copyStats} title="Copy the table as text">
              Copy
            </button>
          </div>

          <div className={styles.tableWrap} onMouseLeave={() => setHovered(null)}>
            <table className={`data ${styles.table}`} data-testid="stats-table">
              <tbody>
                {rows.map((r, k) => {
                  const prevSection = rows[k - 1]?.section
                  return (
                    <StatTableRow
                      key={r.id}
                      row={r}
                      header={r.section !== prevSection ? sectionTitle(r.section) : null}
                      value={value(r)}
                      checked={selected.includes(r.id)}
                      onHover={() => setHovered(r.id)}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>

          {selection && (
            <p className={styles.selectionLine} data-testid="selection-summary">
              Selected: <strong>{formatCombos(selection.union)}</strong> combos (
              {formatPercent((selection.union / Math.max(street.stats.total, 1e-9)) * 100)})
              {selected.length > 1 && <> · in all selected: {formatCombos(selection.overlap)}</>}
              <button type="button" className="ghost" onClick={actions.clearSelection}>
                Clear
              </button>
            </p>
          )}
          <FilterBar street={street.street} />
          <StatDetails statId={hovered} />
        </>
      )}
    </section>
  )
}

function sectionTitle(section: StatRow['section']): string {
  return section === 'made' ? 'Made hands' : section === 'draws' ? 'Draws' : 'Custom stats'
}

function StatTableRow(props: {
  row: StatRow
  header: string | null
  value: string
  checked: boolean
  onHover: () => void
}) {
  const { row, header, value, checked, onHover } = props
  return (
    <>
      {header && (
        <tr className={styles.sectionRow}>
          <th colSpan={3}>{header}</th>
        </tr>
      )}
      <tr
        className={`${styles.row} ${checked ? styles.checked : ''} ${row.combos <= 0 ? styles.zero : ''}`}
        onMouseEnter={onHover}
        onClick={() => actions.toggleStat(row.id)}
        data-stat={row.id}
      >
        <td style={{ paddingLeft: 6 + row.depth * 16 }}>
          <label className={styles.label} onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" checked={checked} onChange={() => actions.toggleStat(row.id)} />
            {row.label}
          </label>
        </td>
        <td className={styles.value}>{value}</td>
        <td className={styles.barCell} aria-hidden="true">
          <span className={styles.bar} style={{ width: `${Math.min(100, row.percent)}%` }} />
        </td>
      </tr>
    </>
  )
}

function StreetTimeline() {
  const board = useStore((s) => s.board)
  const view = useStore((s) => s.view)
  const player = useStore((s) => s.players.find((p) => p.id === s.activeId)!)
  const available = streetsFor(board.length)
  const items: { id: 'preflop' | Street; label: string; enabled: boolean; filters: number }[] = [
    { id: 'preflop', label: 'Preflop', enabled: true, filters: 0 },
    ...STREETS.map((s) => ({
      id: s,
      label: s.charAt(0).toUpperCase() + s.slice(1),
      enabled: available.includes(s),
      filters: player.filters[s].length,
    })),
  ]
  return (
    <nav className={styles.timeline} aria-label="Street">
      {items.map((it, k) => (
        <span key={it.id} className={styles.timelineItem}>
          {k > 0 && (
            <span className={styles.arrow} aria-hidden="true">
              ›
            </span>
          )}
          <button
            type="button"
            aria-pressed={view === it.id}
            disabled={!it.enabled}
            onClick={() => actions.setView(it.id)}
            data-testid={`street-${it.id}`}
          >
            {it.label}
            {it.filters > 0 && (
              <span className={styles.badge} title={`${it.filters} filter(s)`}>
                {it.filters}
              </span>
            )}
          </button>
        </span>
      ))}
    </nav>
  )
}

function FilterBar({ street }: { street: Street }) {
  const selected = useStore((s) => s.selectedStats)
  const customStats = useStore((s) => s.customStats)
  const filters = useStore((s) => s.players.find((p) => p.id === s.activeId)!.filters[street])
  const [weight, setWeight] = useState(100)
  const [inverted, setInverted] = useState(false)
  const none = selected.length === 0

  const add = (mode: 'keep' | 'remove') =>
    actions.addFilter(street, {
      id: newId('f'),
      condition: anyOfStats(selected),
      mode,
      weight: Math.max(0, Math.min(100, weight)) / 100,
      inverted,
    })

  return (
    <div className={styles.filters}>
      <div className="row">
        <strong>Filter</strong>
        <button
          type="button"
          className="primary"
          disabled={none}
          onClick={() => add('keep')}
          data-testid="filter-keep"
        >
          Keep
        </button>
        <button
          type="button"
          disabled={none}
          onClick={() => add('remove')}
          data-testid="filter-remove"
        >
          Remove
        </button>
        <label className="row" title="Share of matching combos the filter acts on">
          at
          <input
            type="number"
            min={0}
            max={100}
            step={5}
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            className={styles.weight}
            aria-label="Filter weight percent"
          />
          %
        </label>
        <button
          type="button"
          aria-pressed={inverted}
          onClick={() => setInverted(!inverted)}
          title="Act on hands NOT in the selection"
        >
          Invert
        </button>
      </div>
      {filters.length > 0 && (
        <ol className={styles.filterList} data-testid="filter-list">
          {filters.map((f) => (
            <li key={f.id}>
              <span>
                {f.mode === 'keep' ? 'Keep' : 'Remove'}
                {f.weight < 1 ? ` ${Math.round(f.weight * 100)}% of` : ''}{' '}
                {f.inverted ? 'NOT ' : ''}
                {describeCondition(f.condition, { customStats })}
              </span>
              <button
                type="button"
                className="ghost"
                aria-label="Delete filter"
                onClick={() => actions.removeFilter(street, f.id)}
              >
                ✕
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="ghost" onClick={() => actions.clearFilters(street)}>
              Clear filters
            </button>
          </li>
        </ol>
      )}
    </div>
  )
}

/** Which hand classes make up a stat (mouse-over details). */
function StatDetails({ statId }: { statId: string | null }) {
  const view = useActiveView()
  const customStats = useStore((s) => s.customStats)
  const street = view.street
  const details = useMemo(() => {
    if (!statId || !street) return null
    const test = compileCondition({ type: 'stat', stat: statId }, { customStats })
    const perClass = new Float64Array(NUM_CLASSES)
    street.stats.classes.forEach((p, i) => {
      const w = street.stats.weights[i]!
      if (p >= 0 && w > 0 && test(p, i)) perClass[COMBO_CLASS[i]!]! += w
    })
    const list: { cls: number; combos: number }[] = []
    perClass.forEach((combos, cls) => combos > 0 && list.push({ cls, combos }))
    list.sort((a, b) => b.combos - a.combos)
    return list
  }, [statId, street, customStats])

  if (!details || !statId)
    return <p className={`muted ${styles.details}`}>Hover a stat to see the hands in it.</p>
  const label = street?.stats.rows.find((r) => r.id === statId)?.label ?? statId
  return (
    <div className={styles.details} aria-live="polite">
      <strong>{label}:</strong>{' '}
      {details.length === 0
        ? 'no hands'
        : details.slice(0, 40).map((d) => (
            <span key={d.cls} className={styles.detailItem}>
              {className(d.cls)}
              <span className="muted">
                {' '}
                {formatCombos(d.combos)}/{CLASS_COMBOS[d.cls]!.length}
              </span>
            </span>
          ))}
      {details.length > 40 && <span className="muted"> …and {details.length - 40} more</span>}
    </div>
  )
}
