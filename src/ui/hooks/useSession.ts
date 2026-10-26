import { useEffect } from 'react'
import { loadSession, saveSession } from '../state/persist.ts'
import { SHARE_PREFIX, decodeState, encodeState } from '../state/serialize.ts'
import { actions, useStore } from '../state/store.ts'

const AUTOSAVE_MS = 400

/** Restores a share link or the last session on startup, then autosaves changes. */
export function useSession(): void {
  useEffect(() => {
    const hash = window.location.hash
    const fromLink = hash.startsWith(SHARE_PREFIX)
      ? decodeState(hash.slice(SHARE_PREFIX.length))
      : null
    if (fromLink) {
      actions.restoreSnapshot(fromLink.snapshot, fromLink.view)
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    } else {
      const saved = loadSession()
      const restored = saved ? decodeState(saved) : null
      if (restored) actions.restoreSnapshot(restored.snapshot, restored.view)
    }

    let timer: ReturnType<typeof setTimeout> | null = null
    const unsubscribe = useStore.subscribe((s, prev) => {
      if (
        s.players === prev.players &&
        s.board === prev.board &&
        s.dead === prev.dead &&
        s.groups === prev.groups &&
        s.customStats === prev.customStats &&
        s.view === prev.view &&
        s.activeId === prev.activeId
      ) {
        return
      }
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const st = useStore.getState()
        saveSession(encodeState(st, st.view))
      }, AUTOSAVE_MS)
    })
    return () => {
      unsubscribe()
      if (timer) clearTimeout(timer)
    }
  }, [])
}

/** Applies theme and zoom preferences to the document. */
export function useDocumentPrefs(): void {
  const theme = useStore((s) => s.prefs.theme)
  const scale = useStore((s) => s.prefs.scale)
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') delete root.dataset.theme
    else root.dataset.theme = theme
  }, [theme])
  useEffect(() => {
    document.documentElement.style.setProperty('--scale', String(scale))
  }, [scale])
}
