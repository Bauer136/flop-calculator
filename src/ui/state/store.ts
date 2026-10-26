import { create } from 'zustand'
import {
  type Card,
  type CustomStat,
  type FilterStep,
  type Group,
  type StatId,
  type Street,
  type StreetFilters,
  createRange,
  emptyStreetFilters,
  parseRangeStrict,
  streetsFor,
} from '../../engine/index.ts'
import { loadPrefs, savePrefs } from './persist.ts'

export type ViewStreet = 'preflop' | Street

export interface Player {
  id: string
  name: string
  color: string
  range: Float32Array
  filters: StreetFilters
}

/** The undoable part of the state. */
export interface Snapshot {
  players: Player[]
  activeId: string
  board: Card[]
  dead: Card[]
  groups: Group[]
  customStats: CustomStat[]
}

export interface Prefs {
  units: 'combos' | 'percent'
  theme: 'system' | 'light' | 'dark'
  /** Weight applied when painting the matrix, 0..1. */
  brushWeight: number
  /** UI magnification, e.g. 1 = 100 %. */
  scale: number
  showGroups: boolean
  forceMonteCarlo: boolean
  /** Bunching: players who folded before the action (0 = off). */
  foldedPlayers: number
  /** Folded players hold hands outside this top percentage. */
  foldedTopPercent: number
}

export interface AppState extends Snapshot {
  view: ViewStreet
  selectedStats: StatId[]
  /** Matrix cell shown in the suit picker. */
  selectedClass: number | null
  boardMode: 'board' | 'dead'
  prefs: Prefs
  past: Snapshot[]
  future: Snapshot[]
}

export const MAX_PLAYERS = 10
const HISTORY_LIMIT = 200

export const PLAYER_COLORS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#9333ea',
  '#ea580c',
  '#0891b2',
  '#db2777',
  '#65a30d',
  '#ca8a04',
  '#475569',
]

let idCounter = 0
export const newId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`

export function makePlayer(
  index: number,
  range: Float32Array = createRange(),
  name?: string,
): Player {
  return {
    id: newId('p'),
    name: name ?? (index === 0 ? 'Hero' : `Villain ${index}`),
    color: PLAYER_COLORS[index % PLAYER_COLORS.length]!,
    range,
    filters: emptyStreetFilters(),
  }
}

export function initialSnapshot(): Snapshot {
  const hero = makePlayer(0, parseRangeStrict('22+,A2s+,K9s+,Q9s+,J9s+,T9s,98s,ATo+,KJo+,QJo'))
  const villain = makePlayer(1, parseRangeStrict('random'))
  return {
    players: [hero, villain],
    activeId: hero.id,
    board: [],
    dead: [],
    groups: [],
    customStats: [],
  }
}

export const DEFAULT_PREFS: Prefs = {
  units: 'combos',
  theme: 'system',
  brushWeight: 1,
  scale: 1,
  showGroups: true,
  forceMonteCarlo: false,
  foldedPlayers: 0,
  foldedTopPercent: 30,
}

const snapshotOf = (s: Snapshot): Snapshot => ({
  players: s.players,
  activeId: s.activeId,
  board: s.board,
  dead: s.dead,
  groups: s.groups,
  customStats: s.customStats,
})

/** Latest street available for a board, or preflop. */
export function latestView(boardLength: number): ViewStreet {
  const streets = streetsFor(boardLength)
  return streets[streets.length - 1] ?? 'preflop'
}

export const useStore = create<AppState>(() => ({
  ...initialSnapshot(),
  view: 'preflop',
  selectedStats: [],
  selectedClass: null,
  boardMode: 'board',
  prefs: { ...DEFAULT_PREFS, ...loadPrefs() },
  past: [],
  future: [],
}))

const set = useStore.setState
const get = useStore.getState

/** Applies an undoable change: the current snapshot goes onto the history stack. */
function commit(change: (s: AppState) => Partial<Snapshot>): void {
  const s = get()
  const patch = change(s)
  set({
    ...patch,
    past: [...s.past.slice(-(HISTORY_LIMIT - 1)), snapshotOf(s)],
    future: [],
  })
  afterChange()
}

/** Keeps view and selection consistent with the board. */
function afterChange(): void {
  const s = get()
  const available = streetsFor(s.board.length)
  if (s.view !== 'preflop' && !available.includes(s.view)) set({ view: latestView(s.board.length) })
  if (!s.players.some((p) => p.id === s.activeId)) set({ activeId: s.players[0]!.id })
}

const mapActive = (s: AppState, fn: (p: Player) => Player): Player[] =>
  s.players.map((p) => (p.id === s.activeId ? fn(p) : p))

export const activePlayer = (s: AppState): Player =>
  s.players.find((p) => p.id === s.activeId) ?? s.players[0]!

export const actions = {
  // History
  undo(): void {
    const s = get()
    const prev = s.past[s.past.length - 1]
    if (!prev) return
    set({ ...prev, past: s.past.slice(0, -1), future: [snapshotOf(s), ...s.future] })
    afterChange()
  },
  redo(): void {
    const s = get()
    const next = s.future[0]
    if (!next) return
    set({ ...next, past: [...s.past, snapshotOf(s)], future: s.future.slice(1) })
    afterChange()
  },
  /** Starts a drag gesture: one history entry for the whole gesture. */
  beginGesture(): void {
    const s = get()
    set({ past: [...s.past.slice(-(HISTORY_LIMIT - 1)), snapshotOf(s)], future: [] })
  },
  /** Updates the active range without a history entry (inside a gesture). */
  paintRange(range: Float32Array): void {
    set((s) => ({ players: mapActive(s, (p) => ({ ...p, range })) }))
  },
  /** Replaces the session at startup (share link / autosave) without a history entry. */
  restoreSnapshot(snapshot: Snapshot, view?: ViewStreet): void {
    set({ ...snapshot, view: view ?? latestView(snapshot.board.length), past: [], future: [] })
    afterChange()
  },
  loadSnapshot(snapshot: Snapshot, view?: ViewStreet): void {
    commit(() => snapshot)
    set({ view: view ?? latestView(snapshot.board.length), selectedStats: [], selectedClass: null })
    afterChange()
  },

  // Players and ranges
  setRange(range: Float32Array, playerId?: string): void {
    commit((s) => ({
      players: s.players.map((p) => (p.id === (playerId ?? s.activeId) ? { ...p, range } : p)),
    }))
  },
  setActive(id: string): void {
    set({ activeId: id, selectedStats: [] })
  },
  addPlayer(): void {
    const s = get()
    if (s.players.length >= MAX_PLAYERS) return
    const player = makePlayer(s.players.length, parseRangeStrict('random'))
    commit((st) => ({ players: [...st.players, player], activeId: player.id }))
  },
  removePlayer(id: string): void {
    const s = get()
    if (s.players.length <= 1) return
    commit((st) => ({ players: st.players.filter((p) => p.id !== id) }))
  },
  renamePlayer(id: string, name: string): void {
    commit((s) => ({ players: s.players.map((p) => (p.id === id ? { ...p, name } : p)) }))
  },
  setPlayerColor(id: string, color: string): void {
    commit((s) => ({ players: s.players.map((p) => (p.id === id ? { ...p, color } : p)) }))
  },

  // Board
  setBoard(board: Card[]): void {
    commit((s) => ({ board: board.slice(0, 5), dead: s.dead.filter((c) => !board.includes(c)) }))
    set({ view: latestView(get().board.length) })
  },
  toggleBoardCard(card: Card): void {
    const s = get()
    if (s.boardMode === 'dead') {
      const dead = s.dead.includes(card) ? s.dead.filter((c) => c !== card) : [...s.dead, card]
      commit((st) => ({ dead, board: st.board.filter((c) => c !== card) }))
      return
    }
    if (s.board.includes(card)) {
      actions.setBoard(s.board.filter((c) => c !== card))
    } else if (s.board.length < 5) {
      commit((st) => ({ board: [...st.board, card], dead: st.dead.filter((c) => c !== card) }))
      set({ view: latestView(get().board.length) })
    }
  },
  setDead(dead: Card[]): void {
    commit((s) => ({ dead, board: s.board.filter((c) => !dead.includes(c)) }))
  },
  setBoardMode(mode: 'board' | 'dead'): void {
    set({ boardMode: mode })
  },
  setView(view: ViewStreet): void {
    set({ view, selectedStats: [] })
  },

  // Stat selection and filters
  toggleStat(id: StatId): void {
    set((s) => ({
      selectedStats: s.selectedStats.includes(id)
        ? s.selectedStats.filter((x) => x !== id)
        : [...s.selectedStats, id],
    }))
  },
  clearSelection(): void {
    set({ selectedStats: [] })
  },
  selectClass(cls: number | null): void {
    set({ selectedClass: cls })
  },
  addFilter(street: Street, step: FilterStep): void {
    commit((s) => ({
      players: mapActive(s, (p) => ({
        ...p,
        filters: { ...p.filters, [street]: [...p.filters[street], step] },
      })),
    }))
    set({ selectedStats: [] })
  },
  removeFilter(street: Street, id: string): void {
    commit((s) => ({
      players: mapActive(s, (p) => ({
        ...p,
        filters: { ...p.filters, [street]: p.filters[street].filter((f) => f.id !== id) },
      })),
    }))
  },
  clearFilters(street: Street): void {
    commit((s) => ({
      players: mapActive(s, (p) => ({ ...p, filters: { ...p.filters, [street]: [] } })),
    }))
  },

  // Groups
  setGroups(groups: Group[]): void {
    commit(() => ({ groups }))
  },
  // Custom stats
  setCustomStats(customStats: CustomStat[]): void {
    commit(() => ({ customStats }))
  },

  // Preferences (not undoable, persisted)
  setPrefs(patch: Partial<Prefs>): void {
    const prefs = { ...get().prefs, ...patch }
    set({ prefs })
    savePrefs(prefs)
  },
}
