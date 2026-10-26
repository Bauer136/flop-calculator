import { type CustomStat, anyOfStats, describeCondition } from '../../../engine/index.ts'
import { actions, newId, useStore } from '../../state/store.ts'
import { ConditionEditor } from './ConditionEditor.tsx'
import styles from './Tabs.module.css'

export function CustomStatsTab() {
  const customStats = useStore((s) => s.customStats)
  const selected = useStore((s) => s.selectedStats)

  const update = (k: number, patch: Partial<CustomStat>) =>
    actions.setCustomStats(customStats.map((c, j) => (j === k ? { ...c, ...patch } : c)))
  const move = (k: number, dir: -1 | 1) => {
    const next = [...customStats]
    const [c] = next.splice(k, 1)
    next.splice(k + dir, 0, c!)
    actions.setCustomStats(next)
  }
  const add = (mode: 'blank' | 'and' | 'or') => {
    const condition =
      mode === 'blank' || selected.length === 0
        ? ({ type: 'stat', stat: 'made.topPair' } as const)
        : mode === 'or'
          ? anyOfStats(selected)
          : {
              type: 'and' as const,
              items: selected.map((stat) => ({ type: 'stat' as const, stat })),
            }
    actions.setCustomStats([
      ...customStats,
      {
        id: newId('c'),
        name:
          mode === 'blank'
            ? `Custom stat ${customStats.length + 1}`
            : describeCondition(condition, { customStats }),
        condition,
      },
    ])
  }

  return (
    <div className={styles.tab}>
      <div className="row">
        <span className="muted">
          Custom stats appear in the stats table and can be used in filters and groups.
        </span>
        <span className="spacer" />
        <button
          type="button"
          disabled={selected.length < 2}
          onClick={() => add('and')}
          title="Hands in every selected stat"
        >
          From selection (AND)
        </button>
        <button
          type="button"
          disabled={selected.length < 1}
          onClick={() => add('or')}
          title="Hands in any selected stat"
        >
          From selection (OR)
        </button>
        <button type="button" className="primary" onClick={() => add('blank')}>
          + Stat
        </button>
      </div>
      {customStats.length === 0 && (
        <p className="muted">No custom stats yet. Example: Top pair AND Flush draw.</p>
      )}
      {customStats.map((c, k) => (
        <div key={c.id} className={styles.groupItem}>
          <div className="row">
            <input
              value={c.name}
              onChange={(e) => update(k, { name: e.target.value })}
              aria-label="Stat name"
            />
            <span className="muted">{describeCondition(c.condition, { customStats })}</span>
            <span className="spacer" />
            <button
              type="button"
              className="ghost"
              disabled={k === 0}
              onClick={() => move(k, -1)}
              aria-label="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              className="ghost"
              disabled={k === customStats.length - 1}
              onClick={() => move(k, 1)}
              aria-label="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => actions.setCustomStats(customStats.filter((_, j) => j !== k))}
              aria-label={`Delete ${c.name}`}
            >
              ✕
            </button>
          </div>
          <ConditionEditor value={c.condition} onChange={(condition) => update(k, { condition })} />
        </div>
      ))}
    </div>
  )
}
