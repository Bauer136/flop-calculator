import { beforeEach, describe, expect, it } from 'vitest'
import { comboCount, formatRange, parseCards, parseRangeStrict } from '../../engine/index.ts'
import { exportLibrary, importLibrary } from '../library/library.ts'
import { decodeState, encodeState } from './serialize.ts'
import { actions, activePlayer, initialSnapshot, useStore } from './store.ts'

beforeEach(() => {
  actions.restoreSnapshot(initialSnapshot())
})

describe('store', () => {
  it('undoes and redoes range edits', () => {
    const before = activePlayer(useStore.getState()).range
    actions.setRange(parseRangeStrict('AA'))
    expect(comboCount(activePlayer(useStore.getState()).range)).toBe(6)
    actions.undo()
    expect(activePlayer(useStore.getState()).range).toBe(before)
    actions.redo()
    expect(comboCount(activePlayer(useStore.getState()).range)).toBe(6)
  })

  it('records one history entry per paint gesture', () => {
    const depth = useStore.getState().past.length
    actions.beginGesture()
    actions.paintRange(parseRangeStrict('AA'))
    actions.paintRange(parseRangeStrict('AA,KK'))
    expect(useStore.getState().past.length).toBe(depth + 1)
    actions.undo()
    expect(useStore.getState().past.length).toBe(depth)
  })

  it('builds the board card by card and follows the newest street', () => {
    for (const c of parseCards('Ks7d2c')) actions.toggleBoardCard(c)
    expect(useStore.getState().view).toBe('flop')
    actions.toggleBoardCard(parseCards('9h')[0]!)
    expect(useStore.getState().view).toBe('turn')
    actions.toggleBoardCard(parseCards('7d')[0]!)
    expect(useStore.getState().board).toHaveLength(3)
    expect(useStore.getState().view).toBe('flop')
  })

  it('keeps board and dead cards disjoint', () => {
    actions.setBoard(parseCards('Ks7d2c'))
    actions.setBoardMode('dead')
    actions.toggleBoardCard(parseCards('Ks')[0]!)
    const s = useStore.getState()
    expect(s.dead).toEqual(parseCards('Ks'))
    expect(s.board).toEqual(parseCards('7d2c'))
    expect(s.view).toBe('preflop')
    actions.setBoardMode('board')
  })

  it('adds and removes filters for the active player only', () => {
    actions.setBoard(parseCards('Ks7d2c'))
    const step = {
      id: 'x',
      condition: { type: 'true' as const },
      mode: 'keep' as const,
      weight: 1,
      inverted: false,
    }
    actions.addFilter('flop', step)
    const [hero, villain] = useStore.getState().players
    expect(hero!.filters.flop).toHaveLength(1)
    expect(villain!.filters.flop).toHaveLength(0)
    actions.removeFilter('flop', 'x')
    expect(activePlayer(useStore.getState()).filters.flop).toHaveLength(0)
  })

  it('never removes the last player', () => {
    for (const p of useStore.getState().players) actions.removePlayer(p.id)
    expect(useStore.getState().players).toHaveLength(1)
  })
})

describe('share links', () => {
  it('round-trip the full session', () => {
    actions.setRange(parseRangeStrict('QQ+,AKs,[50]AQo[/50]'))
    actions.setBoard(parseCards('Ks7d2c9h'))
    actions.setDead(parseCards('Ah'))
    actions.addFilter('flop', {
      id: 'f1',
      condition: { type: 'stat', stat: 'made.topPair' },
      mode: 'keep',
      weight: 0.5,
      inverted: false,
    })
    actions.setGroups([
      { id: 'g', name: 'Sets', color: '#ff0000', condition: { type: 'stat', stat: 'made.set' } },
    ])
    const s = useStore.getState()
    const decoded = decodeState(encodeState(s, 'turn'))!
    expect(decoded.view).toBe('turn')
    expect(decoded.snapshot.board).toEqual(s.board)
    expect(decoded.snapshot.dead).toEqual(s.dead)
    expect(decoded.snapshot.groups).toEqual(s.groups)
    expect(decoded.snapshot.players.map((p) => formatRange(p.range))).toEqual(
      s.players.map((p) => formatRange(p.range)),
    )
    expect(decoded.snapshot.players[0]!.filters.flop[0]!.weight).toBe(0.5)
  })

  it('rejects garbage', () => {
    expect(decodeState('not-base64!!')).toBeNull()
    expect(decodeState(btoa('{"v":2}'))).toBeNull()
  })
})

describe('library files', () => {
  it('export → import round-trips and validates entries', () => {
    const entries = [
      { id: 'a', name: 'Premiums', category: 'Basics', range: 'QQ+,AK', notes: 'n', updated: 1 },
      { id: 'b', name: 'Pairs', category: 'Basics', range: '22+', notes: '', updated: 2 },
    ]
    expect(importLibrary(exportLibrary(entries))).toEqual(entries)
    expect(() => importLibrary('{')).toThrow(/not valid JSON/)
    expect(() => importLibrary('{"entries":[{"name":"x","range":"AKx"}]}')).toThrow(
      /No valid ranges/,
    )
  })
})
