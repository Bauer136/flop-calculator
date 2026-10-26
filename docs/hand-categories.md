# Hand categories

This is the source of truth for every built-in stat. The implementation is in
`src/engine/categorize/`, and every rule is covered by a test case in
`src/engine/categorize/classify.test.ts`. If you change a rule, change this file and the
test cases together.

Notation: **H** = the two hole cards, **B** = the board (3–5 cards), **D** = distinct board ranks
sorted high → low (D[0] is the top card).

## Made hands (exclusive)

Every live combo gets exactly one made-hand category. Rules are checked top-down and the first
match wins, so the made-hand rows always add up to 100 % of the range.

| # | Stat | Rule | Examples |
|---|---|---|---|
| 1 | Straight flush | The best hand of H∪B is a straight flush, and either the board has fewer than 5 cards or the hand beats the board's own value | `4h5h` on `Ah2h3h`; `ThJh` on `9h8h7h2c3d` |
| 2 | Quads | Best hand is four of a kind with **at least one hole card among the four** (a kicker alone doesn't count) | `7s2c` on `7c7d7h`; `Ks2s` on `KcKdKh7c7d`; but `Ah2c` on `KcKdKhKs` is *Ace high* |
| 3 | Full house | Best hand is a full house that the board alone can't match | `7c7d` on `KcKd7h`; `AsAd` on `7c7d7h`; `AhAs` on `KcKdKh7c7d` |
| 4 | Flush | Best hand is a flush and a hole card is in the top five of that suit (on a 5-flush board the hand must beat the board flush) | `AhKc` on `2h5h9hJh`; `3h4c` on `2h5h9hJhKh` |
| 5 | Straight | Best hand is a straight higher than any straight the board makes alone | `As5s` on `4c3d2h`; `Jh2d` on `9c8d7h6sTc` |
| 6 | Board plays | River only: hole + board scores exactly the same as the board alone | `AhAd` / `5h2d` on `9c8d7h6sTc`; `5h5d` on `5c6d7h8s9c`; `7h2s` on `KcKdKh7c7d` |
| 7 | Set | Pocket pair whose rank is on the board | `7h7s` on `Ks7d2c` |
| 8 | Trips | One hole card matches a rank that is paired on the board | `Ks5s` on `KcKd7h` |
| 9 | Two pair | Both hole cards (different ranks) each pair a different unpaired board card | `Kh7h` on `Ks7d2c` |
| 10 | Overpair | Pocket pair above D[0] | `AsAh` on `Ks7d2c` |
| 11 | Top pair | One hole card pairs D[0] (unpaired on the board) | `AhKh` on `Ks7d2c` |
| 12 | PP below top pair | Pocket pair between D[1] and D[0] (or below D[0] when the board has a single rank) | `QhQd` on `Ks7d2c`; `QhQs` on `KcKd7h` |
| 13 | Middle pair | One hole card pairs D[1], and the board has ≥ 3 distinct ranks | `7h6h` on `Ks7d2c`; `9h8h` on `Ks9d5c2h` |
| 14 | Weak pair | One hole card pairs a lower board rank (D[1] when the board has only 2 distinct ranks, D[2]…), or a pocket pair below D[1] | `As2s` on `Ks7d2c`; `Ah7s` on `KcKd7h`; `3h3d` on `Ks9d5c2h` |
| 15 | Ace high | No pair made with a hole card, and a hole card is an ace | `AhQd` on `Ks7d2c`; `Ah2c` on `KcKdKhKs` |
| 16 | No made hand | Everything else | `6h5h` on `Ks7d2c` |

**Top-pair kicker** (sub-rows of Top pair). Take the ranks that are not on the board, sorted
high → low. The first one is the **top kicker**, the next two are **good kickers**, and the rest are
**weak kickers**. On `Ks7d2c`: A = top, Q/J = good, T and below = weak. On `As8d3c`: K = top, Q/J =
good.

Notes:

- Rules 1–5 deliberately don't credit big hands made entirely by the board. A combo that misses
  that check falls through to rule 6 (river) or to the pair rules.
- A pocket pair on a trips board (`AsAd` on `7c7d7h`) is a full house, not an overpair.

## Draws (non-exclusive, flop and turn only)

Draw flags are independent of each other and of the made hand. None are reported on the river.

| Stat | Rule | Examples |
|---|---|---|
| Flush draw | Some suit has exactly 4 cards in H∪B, including ≥ 1 hole card | `JhTh` on `9h8h2c` |
| ↳ Nut flush draw | The hand holds the highest card of that suit that isn't on the board | `AhKh` on `9h8h2c`; `KhQh` on `Ah7h2c` |
| ↳ 2-card / 1-card | Both / one of the hole cards are of the draw's suit | `QsJd` on `Ks8s3s` is 1-card |
| Backdoor flush draw | Flop only, no flush draw, and some suit has exactly 3 cards in H∪B including ≥ 1 hole card | `As2s` on `Ks7d2c` (2-card); `Th7c` on `9h8h2c` (1-card) |
| No flush draw | No flush draw, no backdoor flush draw, and no made flush | |
| OESD | ≥ 2 distinct out ranks (see below). Double gutshots count here | `JhTh` on `9h8h2c`; `8s7s` on `Jc9d5h` (double gutter) |
| Gutshot | Exactly 1 out rank | `Jc7d` on `9h8h2c`; `As2s` on `4c3d9h` |
| Backdoor straight draw | Flop only, no OESD/gutshot, and some 5-rank straight window containing a hole-only rank is missing exactly two ranks | `AhQd` on `Ks7d2c`; `6h5h` on `Ks7d2c` |
| Overcards | Made hand is Ace high / No made hand, and both hole cards are above D[0] | `AhKh` on `9h8h2c` |
| Combo draw | Flush draw and (OESD or gutshot) | |
| Air | Ace high / No made hand with no flush draw, OESD or gutshot | |

**Out ranks.** A rank r is an out when all three hold:

1. the hand has no straight yet;
2. adding a card of rank r gives a straight; and
3. that straight is higher than any straight the board plus r makes alone, so a hole card is
   needed.

On the turn board `5c6d7h8s`, `AhKd` has no straight draw: a 4 or 9 makes a straight for everyone.
`Th2d` has a gutshot to the 9, because that makes the T-high straight while the board only makes
9-high.

A *hole-only rank* is a hole-card rank that isn't on the board.
