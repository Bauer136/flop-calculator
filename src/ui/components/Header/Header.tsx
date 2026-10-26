import { useState } from 'react'
import { MAX_PLAYERS, actions, useStore } from '../../state/store.ts'
import { shareUrl } from '../../state/serialize.ts'
import { copyText } from '../../format.ts'
import styles from './Header.module.css'

export function Header({
  onOpenLibrary,
  onOpenHelp,
}: {
  onOpenLibrary: () => void
  onOpenHelp: () => void
}) {
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const theme = useStore((s) => s.prefs.theme)
  const scale = useStore((s) => s.prefs.scale)
  const [shared, setShared] = useState(false)

  const share = async () => {
    const s = useStore.getState()
    const url = shareUrl(s, s.view)
    window.history.replaceState(null, '', url)
    if (await copyText(url)) {
      setShared(true)
      setTimeout(() => setShared(false), 1500)
    }
  }

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Flop Calculator</h1>
      <PlayersBar />
      <span className="spacer" />
      <div className="row">
        <button type="button" onClick={actions.undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          Undo
        </button>
        <button
          type="button"
          onClick={actions.redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          Redo
        </button>
        <button type="button" onClick={onOpenLibrary} title="Saved ranges (L)">
          Library
        </button>
        <button type="button" onClick={share} title="Copy a link to this exact setup">
          {shared ? 'Link copied' : 'Share'}
        </button>
        <select
          value={theme}
          onChange={(e) => actions.setPrefs({ theme: e.target.value as typeof theme })}
          aria-label="Theme"
        >
          <option value="system">System theme</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
        <select
          value={scale}
          onChange={(e) => actions.setPrefs({ scale: Number(e.target.value) })}
          aria-label="Zoom"
        >
          {[0.9, 1, 1.15, 1.3].map((v) => (
            <option key={v} value={v}>
              {Math.round(v * 100)}%
            </option>
          ))}
        </select>
        <button type="button" onClick={onOpenHelp} title="Keyboard shortcuts (?)" aria-label="Help">
          ?
        </button>
      </div>
    </header>
  )
}

function PlayersBar() {
  const players = useStore((s) => s.players)
  const activeId = useStore((s) => s.activeId)
  const [editing, setEditing] = useState<string | null>(null)

  return (
    <nav className={styles.players} aria-label="Players">
      {players.map((p, k) => (
        <span key={p.id} className={`${styles.player} ${p.id === activeId ? styles.active : ''}`}>
          <input
            type="color"
            value={p.color}
            onChange={(e) => actions.setPlayerColor(p.id, e.target.value)}
            className={styles.color}
            aria-label={`${p.name} color`}
          />
          {editing === p.id ? (
            <input
              autoFocus
              defaultValue={p.name}
              className={styles.nameInput}
              aria-label="Player name"
              onBlur={(e) => {
                const name = e.target.value.trim()
                if (name && name !== p.name) actions.renamePlayer(p.id, name)
                setEditing(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') setEditing(null)
              }}
            />
          ) : (
            <button
              type="button"
              className="ghost"
              aria-pressed={p.id === activeId}
              onClick={() => actions.setActive(p.id)}
              onDoubleClick={() => setEditing(p.id)}
              title={`${p.name} (${k + 1}) · double-click to rename`}
              data-testid={`player-${k}`}
            >
              {p.name}
            </button>
          )}
          {players.length > 1 && p.id === activeId && (
            <button
              type="button"
              className={`ghost ${styles.remove}`}
              onClick={() => actions.removePlayer(p.id)}
              aria-label={`Remove ${p.name}`}
              title="Remove player"
            >
              ✕
            </button>
          )}
        </span>
      ))}
      <button
        type="button"
        onClick={actions.addPlayer}
        disabled={players.length >= MAX_PLAYERS}
        title="Add a player"
        data-testid="add-player"
      >
        + Player
      </button>
    </nav>
  )
}
