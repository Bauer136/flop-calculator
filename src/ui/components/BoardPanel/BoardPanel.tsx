import { useState } from 'react'
import { RANK_CHARS, makeCard, parseCards } from '../../../engine/index.ts'
import { randomFlop, randomNextCard } from '../../boardActions.ts'
import { actions, useStore } from '../../state/store.ts'
import { SUIT_SYMBOLS, cardName, suitVar } from '../../format.ts'
import { CardFace } from '../Card/Card.tsx'
import styles from './BoardPanel.module.css'

const SUIT_ROWS = [3, 2, 1, 0] // spades, hearts, diamonds, clubs
const SLOT_LABELS = ['Flop', 'Flop', 'Flop', 'Turn', 'River']

export function BoardPanel() {
  const board = useStore((s) => s.board)
  const dead = useStore((s) => s.dead)
  const mode = useStore((s) => s.boardMode)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const applyText = () => {
    try {
      const cards = parseCards(text)
      if (cards.length > 5) throw new Error('A board has at most 5 cards')
      if (mode === 'dead') actions.setDead(cards)
      else actions.setBoard(cards)
      setError(null)
      setText('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <section className={`panel ${styles.panel}`} aria-label="Board">
      <div className="row">
        <h2>Board</h2>
        <div className={styles.slots} data-testid="board-slots">
          {SLOT_LABELS.map((label, k) => {
            const card = board[k]
            return card === undefined ? (
              <span key={k} className={styles.slot} title={label}>
                {k === 3 ? 'T' : k === 4 ? 'R' : ''}
              </span>
            ) : (
              <button
                key={k}
                type="button"
                className={styles.slotFilled}
                onClick={() => actions.setBoard(board.filter((c) => c !== card))}
                title={`Remove ${cardName(card)}`}
              >
                <CardFace card={card} />
              </button>
            )
          })}
        </div>
        <span className="spacer" />
        <div role="group" aria-label="Card picker mode" className="row">
          <button
            type="button"
            aria-pressed={mode === 'board'}
            onClick={() => actions.setBoardMode('board')}
          >
            Board
          </button>
          <button
            type="button"
            aria-pressed={mode === 'dead'}
            onClick={() => actions.setBoardMode('dead')}
          >
            Dead cards{dead.length ? ` (${dead.length})` : ''}
          </button>
        </div>
      </div>

      <div className={styles.deck} role="group" aria-label="Deck">
        {SUIT_ROWS.map((suit) => (
          <div key={suit} className={styles.deckRow}>
            {Array.from({ length: 13 }, (_, k) => {
              const rank = 12 - k
              const card = makeCard(rank, suit)
              const onBoard = board.indexOf(card)
              const isDead = dead.includes(card)
              const state = onBoard >= 0 ? styles.onBoard : isDead ? styles.dead : ''
              return (
                <button
                  key={card}
                  type="button"
                  className={`${styles.deckCard} ${state}`}
                  style={{ color: onBoard >= 0 ? undefined : suitVar(suit) }}
                  data-card={RANK_CHARS.charAt(rank) + 'cdhs'.charAt(suit)}
                  aria-label={`${cardName(card)}${onBoard >= 0 ? ' (on board)' : isDead ? ' (dead)' : ''}`}
                  aria-pressed={onBoard >= 0 || isDead}
                  disabled={mode === 'board' && onBoard < 0 && board.length >= 5 && !isDead}
                  onClick={() => actions.toggleBoardCard(card)}
                >
                  {RANK_CHARS.charAt(rank)}
                  <span aria-hidden="true">{SUIT_SYMBOLS[suit]}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div className="row">
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault()
            applyText()
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={mode === 'dead' ? 'Dead cards, e.g. AhKd' : 'e.g. Ks7d2c'}
            aria-label={mode === 'dead' ? 'Dead cards text' : 'Board text'}
            className={styles.textInput}
            data-testid="board-text"
          />
          <button type="submit">Set</button>
        </form>
        <span className="spacer" />
        <button type="button" onClick={randomFlop} title="Random flop (R)">
          Random flop
        </button>
        <button
          type="button"
          onClick={randomNextCard}
          disabled={board.length >= 5}
          title="Random next card (N)"
        >
          Next card
        </button>
        <button
          type="button"
          onClick={() => (mode === 'dead' ? actions.setDead([]) : actions.setBoard([]))}
          title="Clear (C)"
        >
          Clear
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
