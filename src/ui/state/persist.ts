/**
 * Browser storage helpers. Storage can be unavailable (private mode, blocked site data),
 * so every access is guarded and failures fall back silently.
 */
const PREFS_KEY = 'flopcalc.prefs'
const SESSION_KEY = 'flopcalc.session'

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage unavailable: preferences just won't persist.
  }
}

export function loadPrefs(): Record<string, unknown> {
  if (typeof window === 'undefined') return {}
  const raw = read(PREFS_KEY)
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export function savePrefs(prefs: object): void {
  write(PREFS_KEY, JSON.stringify(prefs))
}

export function loadSession(): string | null {
  return read(SESSION_KEY)
}

export function saveSession(encoded: string): void {
  write(SESSION_KEY, encoded)
}
