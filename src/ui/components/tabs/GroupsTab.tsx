import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { type Condition, type Group, anyOfStats } from '../../../engine/index.ts'
import { useActiveView } from '../../hooks/useView.ts'
import { actions, newId, useStore } from '../../state/store.ts'
import { formatCombos, formatPercent } from '../../format.ts'
import { ConditionEditor } from './ConditionEditor.tsx'
import styles from './Tabs.module.css'

const GROUP_COLORS = [
  '#e8590c',
  '#2f9e44',
  '#1971c2',
  '#9c36b5',
  '#f08c00',
  '#0c8599',
  '#c2255c',
  '#5c940d',
]

const PRESET: { name: string; color: string; condition: Condition }[] = [
  {
    name: 'Strong',
    color: '#2f9e44',
    condition: anyOfStats([
      'made.straightFlush',
      'made.quads',
      'made.fullHouse',
      'made.flush',
      'made.straight',
      'made.set',
      'made.trips',
      'made.twoPair',
    ]),
  },
  {
    name: 'Top pair / overpair',
    color: '#1971c2',
    condition: anyOfStats(['made.overpair', 'made.topPair']),
  },
  {
    name: 'Weaker pairs',
    color: '#f08c00',
    condition: anyOfStats(['made.ppBelowTopPair', 'made.middlePair', 'made.weakPair']),
  },
  {
    name: 'Draws',
    color: '#9c36b5',
    condition: anyOfStats(['draw.flushDraw', 'draw.oesd', 'draw.gutshot']),
  },
]

export function GroupsTab() {
  const groups = useStore((s) => s.groups)
  const showGroups = useStore((s) => s.prefs.showGroups)
  const selected = useStore((s) => s.selectedStats)
  const view = useActiveView()
  const assignment = view.street?.groups

  const update = (k: number, patch: Partial<Group>) =>
    actions.setGroups(groups.map((g, j) => (j === k ? { ...g, ...patch } : g)))
  const move = (k: number, dir: -1 | 1) => {
    const next = [...groups]
    const [g] = next.splice(k, 1)
    next.splice(k + dir, 0, g!)
    actions.setGroups(next)
  }
  const add = () =>
    actions.setGroups([
      ...groups,
      {
        id: newId('g'),
        name: `Group ${groups.length + 1}`,
        color: GROUP_COLORS[groups.length % GROUP_COLORS.length]!,
        condition: selected.length ? anyOfStats(selected) : { type: 'stat', stat: 'made.topPair' },
      },
    ])

  const pieData = assignment
    ? [
        ...groups.map((g, k) => ({
          name: g.name,
          value: assignment.totals[k] ?? 0,
          color: g.color,
        })),
        { name: 'Other', value: assignment.ungrouped, color: 'var(--cell-pair)' },
      ].filter((d) => d.value > 0)
    : []

  return (
    <div className={styles.tab}>
      <div className="row">
        <span className="muted">
          Each hand goes to the first group (top to bottom) it matches. Groups color the matrix.
        </span>
        <span className="spacer" />
        <label className="row">
          <input
            type="checkbox"
            checked={showGroups}
            onChange={(e) => actions.setPrefs({ showGroups: e.target.checked })}
          />
          Show on matrix
        </label>
        <button
          type="button"
          onClick={() => actions.setGroups(PRESET.map((p) => ({ ...p, id: newId('g') })))}
        >
          Use preset
        </button>
        <button type="button" className="primary" onClick={add}>
          + Group{selected.length ? ' from selection' : ''}
        </button>
      </div>
      <div className={styles.columns}>
        <div className={styles.groupList}>
          {groups.length === 0 && <p className="muted">No groups yet.</p>}
          {groups.map((g, k) => (
            <div key={g.id} className={styles.groupItem}>
              <div className="row">
                <input
                  type="color"
                  value={g.color}
                  onChange={(e) => update(k, { color: e.target.value })}
                  aria-label={`${g.name} color`}
                />
                <input
                  value={g.name}
                  onChange={(e) => update(k, { name: e.target.value })}
                  aria-label="Group name"
                />
                {assignment && (
                  <span className="muted">
                    {formatCombos(assignment.totals[k] ?? 0)} combos ·{' '}
                    {formatPercent(
                      ((assignment.totals[k] ?? 0) / Math.max(assignment.total, 1e-9)) * 100,
                    )}
                  </span>
                )}
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
                  disabled={k === groups.length - 1}
                  onClick={() => move(k, 1)}
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => actions.setGroups(groups.filter((_, j) => j !== k))}
                  aria-label={`Delete ${g.name}`}
                >
                  ✕
                </button>
              </div>
              <ConditionEditor
                value={g.condition}
                onChange={(condition) => update(k, { condition })}
              />
            </div>
          ))}
        </div>
        {pieData.length > 0 && (
          <div className={styles.pie} data-testid="group-pie">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={90}
                  isAnimationActive={false}
                >
                  {pieData.map((d) => (
                    <Cell key={d.name} fill={d.color} stroke="var(--surface)" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => `${formatCombos(Number(v))} combos`}
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
