import { get, set } from 'idb-keyval'
import { formatRange, parseRange, parseRangeStrict, topPercentRange } from '../../engine/index.ts'
import { newId } from '../state/store.ts'

export interface LibraryEntry {
  id: string
  name: string
  category: string
  /** Range text (compact format). */
  range: string
  notes: string
  updated: number
}

interface LibraryFile {
  app: 'flop-calculator'
  version: 1
  entries: LibraryEntry[]
}

const KEY = 'flopcalc.library'
let memory: LibraryEntry[] | null = null

const entry = (category: string, name: string, range: string, notes = ''): LibraryEntry => ({
  id: newId('r'),
  name,
  category,
  range,
  notes,
  updated: 0,
})

/** Starter ranges. Percentile ranges come from the equity-vs-random ranking. */
export function defaultLibrary(): LibraryEntry[] {
  const pct = (p: number) => formatRange(topPercentRange(p))
  return [
    entry('Basics', 'Premiums', 'QQ+,AK'),
    entry('Basics', 'Pocket pairs', '22+'),
    entry('Basics', 'Broadways', 'TT+,ATs+,KTs+,QTs+,JTs,ATo+,KTo+,QTo+,JTo'),
    entry('Basics', 'Suited aces', 'A2s+'),
    entry('Basics', 'Suited connectors', '54s,65s,76s,87s,98s,T9s,JTs'),
    entry('Basics', 'Any two cards', 'random'),
    ...[5, 10, 15, 20, 30, 40, 50].map((p) =>
      entry(
        'Top % (by equity vs random)',
        `Top ${p}%`,
        pct(p),
        'Ranked by all-in equity against one random hand.',
      ),
    ),
  ]
}

function valid(e: unknown): e is LibraryEntry {
  if (!e || typeof e !== 'object') return false
  const x = e as Record<string, unknown>
  return (
    typeof x.name === 'string' &&
    typeof x.range === 'string' &&
    parseRange(x.range).errors.length === 0
  )
}

function normalize(e: LibraryEntry): LibraryEntry {
  return {
    id: typeof e.id === 'string' ? e.id : newId('r'),
    name: e.name.trim() || 'Untitled',
    category: typeof e.category === 'string' && e.category.trim() ? e.category.trim() : 'Saved',
    range: e.range,
    notes: typeof e.notes === 'string' ? e.notes : '',
    updated: typeof e.updated === 'number' ? e.updated : Date.now(),
  }
}

export async function loadLibrary(): Promise<LibraryEntry[]> {
  if (memory) return memory
  try {
    const stored = await get<unknown>(KEY)
    memory = Array.isArray(stored) ? stored.filter(valid).map(normalize) : defaultLibrary()
  } catch {
    memory = defaultLibrary()
  }
  return memory
}

export async function saveLibrary(entries: LibraryEntry[]): Promise<void> {
  memory = entries
  try {
    await set(KEY, entries)
  } catch {
    // IndexedDB unavailable: the library lives in memory for this session.
  }
}

export function exportLibrary(entries: LibraryEntry[]): string {
  const file: LibraryFile = { app: 'flop-calculator', version: 1, entries }
  return JSON.stringify(file, null, 2)
}

/** Parses an exported library file; throws a readable error when it's not one. */
export function importLibrary(text: string): LibraryEntry[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  const entries = Array.isArray(data) ? data : (data as Partial<LibraryFile>)?.entries
  if (!Array.isArray(entries)) throw new Error('No ranges found in that file.')
  const good = entries.filter(valid).map(normalize)
  if (good.length === 0) throw new Error('No valid ranges found in that file.')
  return good
}

export const rangeOf = (e: LibraryEntry): Float32Array => parseRangeStrict(e.range)
