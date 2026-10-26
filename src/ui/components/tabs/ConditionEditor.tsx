import type { Condition } from '../../../engine/index.ts'
import { SUIT_SYMBOLS } from '../../format.ts'
import { StatSelect } from './shared.tsx'
import styles from './Tabs.module.css'

type Kind = Condition['type']

const KIND_LABELS: Record<Kind, string> = {
  stat: 'Stat',
  suit: 'Suit',
  suited: 'Suitedness',
  equity: 'Equity',
  and: 'All of (AND)',
  or: 'Any of (OR)',
  not: 'Not',
  true: 'Any hand',
}

function defaultFor(kind: Kind): Condition {
  switch (kind) {
    case 'stat':
      return { type: 'stat', stat: 'made.topPair' }
    case 'suit':
      return { type: 'suit', suit: 2, min: 1 }
    case 'suited':
      return { type: 'suited', suited: true }
    case 'equity':
      return { type: 'equity', min: 0.5, max: 1 }
    case 'and':
    case 'or':
      return { type: kind, items: [{ type: 'stat', stat: 'made.topPair' }] }
    case 'not':
      return { type: 'not', item: { type: 'stat', stat: 'made.topPair' } }
    case 'true':
      return { type: 'true' }
  }
}

/** Recursive editor for a Condition tree. */
export function ConditionEditor(props: {
  value: Condition
  onChange: (c: Condition) => void
  onRemove?: () => void
  /** Nesting level, for indentation. */
  depth?: number
}) {
  const { value, onChange, onRemove } = props
  const depth = props.depth ?? 0
  return (
    <div className={styles.cond} style={{ marginLeft: depth ? 12 : 0 }}>
      <div className="row">
        <select
          value={value.type}
          onChange={(e) => onChange(defaultFor(e.target.value as Kind))}
          aria-label="Condition type"
        >
          {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
        {value.type === 'stat' && (
          <StatSelect value={value.stat} onChange={(stat) => onChange({ type: 'stat', stat })} />
        )}
        {value.type === 'suit' && (
          <>
            <select
              value={value.min}
              onChange={(e) => onChange({ ...value, min: Number(e.target.value) as 1 | 2 })}
              aria-label="How many hole cards"
            >
              <option value={1}>at least one</option>
              <option value={2}>both</option>
            </select>
            <select
              value={value.suit}
              onChange={(e) => onChange({ ...value, suit: Number(e.target.value) })}
              aria-label="Suit"
            >
              {SUIT_SYMBOLS.map((s, k) => (
                <option key={k} value={k}>
                  {s}
                </option>
              ))}
            </select>
          </>
        )}
        {value.type === 'suited' && (
          <select
            value={value.suited ? 'yes' : 'no'}
            onChange={(e) => onChange({ type: 'suited', suited: e.target.value === 'yes' })}
            aria-label="Suited or offsuit"
          >
            <option value="yes">suited</option>
            <option value="no">offsuit</option>
          </select>
        )}
        {value.type === 'equity' && (
          <>
            <input
              type="number"
              min={0}
              max={100}
              value={Math.round(value.min * 100)}
              onChange={(e) => onChange({ ...value, min: Number(e.target.value) / 100 })}
              className={styles.num}
              aria-label="Minimum equity percent"
            />
            to
            <input
              type="number"
              min={0}
              max={100}
              value={Math.round(value.max * 100)}
              onChange={(e) => onChange({ ...value, max: Number(e.target.value) / 100 })}
              className={styles.num}
              aria-label="Maximum equity percent"
            />
            %
          </>
        )}
        {(value.type === 'and' || value.type === 'or') && (
          <button
            type="button"
            className="ghost"
            onClick={() => onChange({ ...value, items: [...value.items, defaultFor('stat')] })}
          >
            + condition
          </button>
        )}
        {onRemove && (
          <button type="button" className="ghost" onClick={onRemove} aria-label="Remove condition">
            ✕
          </button>
        )}
      </div>
      {(value.type === 'and' || value.type === 'or') &&
        value.items.map((item, k) => (
          <ConditionEditor
            key={k}
            depth={depth + 1}
            value={item}
            onChange={(c) =>
              onChange({ ...value, items: value.items.map((x, j) => (j === k ? c : x)) })
            }
            onRemove={
              value.items.length > 1
                ? () => onChange({ ...value, items: value.items.filter((_, j) => j !== k) })
                : undefined
            }
          />
        ))}
      {value.type === 'not' && (
        <ConditionEditor
          depth={depth + 1}
          value={value.item}
          onChange={(item) => onChange({ type: 'not', item })}
        />
      )}
    </div>
  )
}
