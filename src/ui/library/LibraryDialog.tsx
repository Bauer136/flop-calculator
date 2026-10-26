import { useEffect, useMemo, useRef, useState } from 'react'
import { comboCount, formatRange } from '../../engine/index.ts'
import { actions, activePlayer, newId, useStore } from '../state/store.ts'
import { formatCombos } from '../format.ts'
import {
  type LibraryEntry,
  defaultLibrary,
  exportLibrary,
  importLibrary,
  loadLibrary,
  rangeOf,
  saveLibrary,
} from './library.ts'
import styles from './LibraryDialog.module.css'

export function LibraryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null)
  const [category, setCategory] = useState<string>('All')
  const [message, setMessage] = useState<string | null>(null)
  const player = useStore(activePlayer)
  const players = useStore((s) => s.players)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
    if (open) void loadLibrary().then(setEntries)
  }, [open])

  const update = (next: LibraryEntry[]) => {
    setEntries(next)
    void saveLibrary(next)
  }

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of entries ?? []) counts.set(e.category, (counts.get(e.category) ?? 0) + 1)
    return [...counts]
  }, [entries])

  const shown = (entries ?? []).filter((e) => category === 'All' || e.category === category)

  const download = () => {
    const blob = new Blob([exportLibrary(entries ?? [])], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'flop-calculator-ranges.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const upload = async (file: File) => {
    try {
      const imported = importLibrary(await file.text())
      update([...(entries ?? []), ...imported])
      setMessage(`Imported ${imported.length} range(s).`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <dialog ref={ref} className={styles.dialog} onClose={onClose} aria-label="Range library">
      <div className={styles.head}>
        <h2>Range library</h2>
        <span className="spacer" />
        <button type="button" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <SaveForm
        categories={categories.map(([c]) => c)}
        onSave={(name, cat, notes) => {
          update([
            ...(entries ?? []),
            {
              id: newId('r'),
              name,
              category: cat,
              notes,
              range: formatRange(player.range),
              updated: Date.now(),
            },
          ])
          setMessage(`Saved “${name}”.`)
        }}
        playerName={player.name}
      />

      <div className={styles.body}>
        <nav className={styles.categories} aria-label="Categories">
          {[['All', entries?.length ?? 0] as const, ...categories].map(([c, n]) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {c} <span className="muted">{n}</span>
            </button>
          ))}
        </nav>
        <ul className={styles.list}>
          {entries === null && <li className="muted">Loading…</li>}
          {shown.map((e) => (
            <EntryRow
              key={e.id}
              entry={e}
              players={players.map((p) => ({ id: p.id, name: p.name }))}
              onLoad={(playerId) => {
                actions.setRange(rangeOf(e), playerId)
                setMessage(`Loaded “${e.name}”.`)
              }}
              onChange={(next) => update((entries ?? []).map((x) => (x.id === e.id ? next : x)))}
              onDelete={() => update((entries ?? []).filter((x) => x.id !== e.id))}
            />
          ))}
        </ul>
      </div>

      <div className={styles.foot}>
        {message && <span role="status">{message}</span>}
        <span className="spacer" />
        <button type="button" onClick={download}>
          Export
        </button>
        <label className={styles.fileButton}>
          Import
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void upload(f)
              e.target.value = ''
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                'Replace the library with the default ranges? Your saved ranges will be removed.',
              )
            ) {
              update(defaultLibrary())
              setCategory('All')
            }
          }}
        >
          Restore defaults
        </button>
      </div>
    </dialog>
  )
}

function SaveForm(props: {
  categories: string[]
  playerName: string
  onSave: (name: string, category: string, notes: string) => void
}) {
  const [name, setName] = useState('')
  const [cat, setCat] = useState('Saved')
  const [notes, setNotes] = useState('')
  return (
    <form
      className={styles.save}
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        props.onSave(name.trim(), cat.trim() || 'Saved', notes)
        setName('')
        setNotes('')
      }}
    >
      <strong>Save {props.playerName}&rsquo;s range</strong>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        aria-label="Range name"
        required
      />
      <input
        value={cat}
        onChange={(e) => setCat(e.target.value)}
        list="library-categories"
        placeholder="Category"
        aria-label="Category"
      />
      <datalist id="library-categories">
        {props.categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        aria-label="Notes"
      />
      <button type="submit" className="primary">
        Save
      </button>
    </form>
  )
}

function EntryRow(props: {
  entry: LibraryEntry
  players: { id: string; name: string }[]
  onLoad: (playerId: string) => void
  onChange: (e: LibraryEntry) => void
  onDelete: () => void
}) {
  const { entry } = props
  const [editing, setEditing] = useState(false)
  const combos = useMemo(() => comboCount(rangeOf(entry)), [entry])
  return (
    <li className={styles.entry}>
      <div className="row">
        {editing ? (
          <input
            autoFocus
            defaultValue={entry.name}
            aria-label="Rename range"
            onBlur={(e) => {
              const name = e.target.value.trim()
              if (name) props.onChange({ ...entry, name, updated: Date.now() })
              setEditing(false)
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        ) : (
          <strong>{entry.name}</strong>
        )}
        <span className="muted">
          {formatCombos(combos)} combos · {((combos / 1326) * 100).toFixed(1)}%
        </span>
        <span className="spacer" />
        <select
          aria-label={`Load ${entry.name} into player`}
          value=""
          onChange={(e) => e.target.value && props.onLoad(e.target.value)}
        >
          <option value="">Load into…</option>
          {props.players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button type="button" className="ghost" onClick={() => setEditing(true)}>
          Rename
        </button>
        <button
          type="button"
          className="ghost"
          onClick={props.onDelete}
          aria-label={`Delete ${entry.name}`}
        >
          Delete
        </button>
      </div>
      <code className={styles.rangeText}>{entry.range}</code>
      <input
        className={styles.notes}
        defaultValue={entry.notes}
        placeholder="Notes"
        aria-label={`Notes for ${entry.name}`}
        onBlur={(e) =>
          e.target.value !== entry.notes &&
          props.onChange({ ...entry, notes: e.target.value, updated: Date.now() })
        }
      />
    </li>
  )
}
