import type { Card as CardValue } from '../../../engine/index.ts'
import { cardLabel, cardName } from '../../format.ts'
import styles from './Card.module.css'

/** A small playing-card face. */
export function CardFace({ card, size = 'md' }: { card: CardValue; size?: 'sm' | 'md' }) {
  const l = cardLabel(card)
  return (
    <span
      className={`${styles.card} ${styles[size]}`}
      style={{ color: l.color }}
      aria-label={cardName(card)}
      role="img"
    >
      {l.rank}
      <span aria-hidden="true">{l.suit}</span>
    </span>
  )
}
