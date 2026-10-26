import { useEffect, useMemo, useRef, useState } from 'react'
import { BoardPanel } from './components/BoardPanel/BoardPanel.tsx'
import { Header } from './components/Header/Header.tsx'
import { RangeEditor } from './components/RangeEditor/RangeEditor.tsx'
import { StatsPanel } from './components/StatsPanel/StatsPanel.tsx'
import { BottomTabs } from './components/tabs/BottomTabs.tsx'
import { useEngineSync } from './hooks/useEngineSync.ts'
import { useDocumentPrefs, useSession } from './hooks/useSession.ts'
import { HOTKEYS, useHotkeys } from './hotkeys.ts'
import { LibraryDialog } from './library/LibraryDialog.tsx'
import { useResults } from './state/results.ts'
import styles from './App.module.css'

function App() {
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const analysisError = useResults((s) => s.analysisError)

  useSession()
  useDocumentPrefs()
  useEngineSync()
  const handlers = useMemo(
    () => ({ openLibrary: () => setLibraryOpen(true), openHelp: () => setHelpOpen(true) }),
    [],
  )
  useHotkeys(handlers)

  return (
    <div className={styles.app}>
      <Header onOpenLibrary={handlers.openLibrary} onOpenHelp={handlers.openHelp} />
      {analysisError && (
        <p className={`error ${styles.banner}`} role="alert">
          Analysis failed: {analysisError}
        </p>
      )}
      <main className={styles.main}>
        <div className={styles.left}>
          <RangeEditor />
        </div>
        <div className={styles.right}>
          <BoardPanel />
          <StatsPanel />
        </div>
        <div className={styles.bottom}>
          <BottomTabs />
        </div>
      </main>
      <LibraryDialog open={libraryOpen} onClose={() => setLibraryOpen(false)} />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}

function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className={styles.help} onClose={onClose} aria-label="Help">
      <div className="row">
        <h2>Keyboard shortcuts</h2>
        <span className="spacer" />
        <button type="button" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <table className="data">
        <tbody>
          {HOTKEYS.map((h) => (
            <tr key={h.keys}>
              <td>{h.action}</td>
              <td className="mono">{h.keys}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Tips</h2>
      <ul>
        <li>
          Drag across the matrix to paint hands; right-drag or Shift-drag erases. The brush sets the
          weight.
        </li>
        <li>
          Tick stats, then Keep or Remove to filter the range. Filters carry over to the next
          street.
        </li>
        <li>
          Hover a stat to list the hands in it; hover a suit button for its exact hand and draws.
        </li>
        <li>Share copies a link that reopens this exact setup.</li>
      </ul>
    </dialog>
  )
}

export default App
