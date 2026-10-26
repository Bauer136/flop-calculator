import {
  type CustomStat,
  type Group,
  type StreetFilters,
  emptyStreetFilters,
  formatCards,
  formatRange,
  parseCards,
  parseRange,
} from '../../engine/index.ts'
import { type Player, type Snapshot, type ViewStreet, makePlayer } from './store.ts'

/** Portable form of the session, used for share links and autosave. */
interface SerializedState {
  v: 1
  players: { name: string; color: string; range: string; filters: StreetFilters }[]
  active: number
  board: string
  dead: string
  groups: Group[]
  customStats: CustomStat[]
  view?: ViewStreet
}

export function serializeSnapshot(s: Snapshot, view?: ViewStreet): SerializedState {
  return {
    v: 1,
    players: s.players.map((p) => ({
      name: p.name,
      color: p.color,
      range: formatRange(p.range),
      filters: p.filters,
    })),
    active: Math.max(
      0,
      s.players.findIndex((p) => p.id === s.activeId),
    ),
    board: formatCards(s.board),
    dead: formatCards(s.dead),
    groups: s.groups,
    customStats: s.customStats,
    view,
  }
}

export function deserializeSnapshot(
  data: unknown,
): { snapshot: Snapshot; view?: ViewStreet } | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Partial<SerializedState>
  if (d.v !== 1 || !Array.isArray(d.players) || d.players.length === 0) return null
  try {
    const players: Player[] = d.players.map((p, i) => ({
      ...makePlayer(
        i,
        parseRange(String(p.range ?? '')).range,
        String(p.name ?? `Player ${i + 1}`),
      ),
      color: typeof p.color === 'string' ? p.color : makePlayer(i).color,
      filters: { ...emptyStreetFilters(), ...(p.filters ?? {}) },
    }))
    const board = parseCards(String(d.board ?? '')).slice(0, 5)
    const dead = parseCards(String(d.dead ?? '')).filter((c) => !board.includes(c))
    return {
      snapshot: {
        players,
        activeId: players[Math.min(players.length - 1, Math.max(0, d.active ?? 0))]!.id,
        board,
        dead,
        groups: Array.isArray(d.groups) ? d.groups : [],
        customStats: Array.isArray(d.customStats) ? d.customStats : [],
      },
      view: d.view,
    }
  } catch {
    return null
  }
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): string {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

export function encodeState(s: Snapshot, view?: ViewStreet): string {
  return toBase64Url(JSON.stringify(serializeSnapshot(s, view)))
}

export function decodeState(encoded: string): { snapshot: Snapshot; view?: ViewStreet } | null {
  try {
    return deserializeSnapshot(JSON.parse(fromBase64Url(encoded)))
  } catch {
    return null
  }
}

export const SHARE_PREFIX = '#s='

export function shareUrl(s: Snapshot, view?: ViewStreet): string {
  const url = new URL(window.location.href)
  url.hash = SHARE_PREFIX.slice(1) + encodeState(s, view)
  return url.toString()
}
