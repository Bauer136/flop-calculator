# Flop Calculator — Build Plan

A browser-based poker range analysis tool built on the Flopzilla concept. You enter one or more
preflop ranges and a board. The tool shows right away how each range hits the board (made hands and
draws), lets you filter the range street by street, and calculates equity.

This is a clean-room build from the publicly described feature set (flopzilla.com home page and
video index). It uses its own name, UI and assets, and copies nothing from the original program.
"Flopzilla" is a trademark of its owner, so the product name stays generic (working name:
**Flop Calculator**).

---

## 1. Feature scope

Tiers: **MVP** is the "classic" experience. **v1** reaches parity with the Pro-level features.
**Stretch** is optional.

| # | Feature | Tier | Phase |
|---|---------|------|-------|
| F1 | 13×13 hand matrix range editor (click / drag paint, weights, per-suit combo picker) | MVP | 6 |
| F2 | Range text input/output (`QQ+, A2s+, KTo+, AhKh`, weights) with two-way sync | MVP | 1, 6 |
| F3 | "Top X %" slider based on a preflop hand ranking | MVP | 5, 6 |
| F4 | Board input (flop / turn / river), random board, dead cards | MVP | 6 |
| F5 | Instant stats table: made hands + draws, in combos and %; no "Compute" button | MVP | 3, 4, 6 |
| F6 | Filter system: select stats → keep / remove / invert; multi-street filter chain | MVP | 4, 6 |
| F7 | Next-card table: how each possible turn/river card changes the stats | v1 | 4, 7 |
| F8 | Equity: hero combo or range vs one or more villain ranges; exact heads-up, Monte Carlo multiway | v1 | 5, 7 |
| F9 | Equity views: summary, per-combo table, equity graph, equity matrix, "hotness" (next-card equity delta) | v1 | 7 |
| F10 | Colored groups (exclusive, priority-ordered buckets shown on matrix + stats + pie chart) | v1 | 4, 7 |
| F11 | Weighted filters (filter keeps hands at X % weight), filter priority | v1 | 4, 7 |
| F12 | Mouse-over stat details (which combos are in a stat) and stat overlap view | v1 | 7 |
| F13 | Preflop statistics: how a hand/range performs over all 22,100 flops | v1 | 8 |
| F14 | Flop breakdown tool: frequency of flop textures (paired, monotone, A-high…) given card removal | v1 | 8 |
| F15 | Custom statistics builder (AND / OR / NOT of stats, suits operator), saved & reorderable | v1 | 8 |
| F16 | Range library ("predefs"): save ranges in categories, import / export / restore defaults | v1 | 9 |
| F17 | Solver interop: import/export the `AA:1,AKs:0.5` range format used by GTO+/PioSolver | v1 | 9 |
| F18 | Text output (copy stats / filtered range as plain text) | v1 | 9 |
| F19 | Undo/redo, hotkeys, dark mode, draw hints, notes | v1 | 6, 10 |
| F20 | Bunching effect (card removal from folded players' fold ranges) | Stretch | 10 |
| F21 | Exact 3-way postflop equity | Stretch | 10 |
| F22 | PWA offline install / Tauri desktop wrapper | Stretch | 10 |

Not in scope: a solver, live direct integration with GTO+ (replaced by F17 text interop), license
keys and registration, game types other than No-Limit Hold'em.

---

## 2. Stack and key decisions

| Concern | Choice | Reason |
|---------|--------|--------|
| Language | TypeScript 6.0, `strict` + `noUncheckedIndexedAccess` | One language for engine and UI (pinned to the Vite template's version; TS 7 can come later) |
| Lint / format | oxlint + Prettier | oxlint is the current Vite template default; it is fast and supports the import-restriction rule |
| App type | Static web app (desktop-first layout, works on tablets) | No install, easy to share; can be wrapped later (F22) |
| Build | Vite | Fast dev server, built-in worker bundling |
| UI | React 19 | Large ecosystem; the matrix and stats are plain component trees |
| State | Zustand (+ small hand-rolled undo/redo history) | Minimal boilerplate; easy to read from outside React |
| Off-main-thread compute | Web Workers + Comlink | Keeps the UI responsive during equity / breakdown jobs |
| Styling | CSS Modules + CSS custom properties (theme tokens) | Matrix cells need inline gradient styles anyway; no Tailwind needed |
| Charts | Recharts (equity graph, pie charts); hand-built SVG/CSS grids for matrix & card grids | Matrix/card grids are custom; only two "real" charts |
| Persistence | IndexedDB via `idb-keyval`; `localStorage` only for UI prefs (wrapped in try/catch) | Range library can grow beyond localStorage limits |
| Unit/property tests | Vitest + fast-check | Same toolchain as Vite; property tests for parsers and invariants |
| E2E tests | Playwright | Real browser flows |
| Package manager | npm (Node 22 is installed) | Already available |

**Engine isolation rule:** everything in `src/engine/` is pure TypeScript with no React, DOM or
`window` imports. This is enforced with an oxlint `no-restricted-imports` override and a separate
`tsconfig.engine.json` whose `lib` excludes `DOM` and whose `types` is empty (no Node globals). It keeps the engine testable in Node and
runnable inside workers. If profiling shows JS is too slow, the evaluator or equity loop can be
swapped for Rust→WASM behind the same interface (Phase 10). The plan does not start with
Rust/WASM: the algorithms below hit the performance targets in plain JS, and a second toolchain
would slow down early iteration.

---

## 3. Repository layout

```
flop-calculator/
├── BUILD_PLAN.md
├── README.md
├── docs/
│   └── hand-categories.md        # source of truth for every stat definition (written in Phase 3)
├── index.html
├── package.json
├── tsconfig.json / tsconfig.engine.json / tsconfig.node.json
├── vite.config.ts / vitest.config.ts / playwright.config.ts
├── .oxlintrc.json / .prettierrc.json
├── .github/workflows/ci.yml
├── scripts/
│   ├── gen-preflop-ranking.ts    # builds src/engine/data/preflopRanking.json
│   └── gen-flop-isomorphs.ts     # optional: precompute 1,755 canonical flops
├── src/
│   ├── engine/                   # PURE — no DOM / React
│   │   ├── cards.ts              # Card encoding, parse/format, deck utilities
│   │   ├── combos.ts             # 1,326 combo tables, 169 hand classes, matrix mapping
│   │   ├── range.ts              # Range type + operations
│   │   ├── rangeParser.ts        # text ⇄ Range (incl. weights, solver format)
│   │   ├── evaluator/
│   │   │   ├── tables.ts         # straight / bit-count lookup tables
│   │   │   └── evaluate.ts       # evaluate5/6/7 → 32-bit strength
│   │   ├── categorize/
│   │   │   ├── categories.ts     # stat ids, labels, order, section, colors
│   │   │   ├── madeHand.ts
│   │   │   ├── draws.ts
│   │   │   └── classify.ts       # classify(combo, board) → HandClass
│   │   ├── analysis/
│   │   │   ├── conditions.ts     # Condition expression model + evaluation
│   │   │   ├── stats.ts          # range × board → StatsTable
│   │   │   ├── filters.ts        # keep / remove / invert / weighted filters
│   │   │   ├── streets.ts        # preflop → flop → turn → river pipeline
│   │   │   ├── nextCard.ts       # per-next-card stats
│   │   │   ├── groups.ts         # colored groups
│   │   │   ├── texture.ts        # flop texture classifier
│   │   │   ├── isomorphism.ts    # suit-isomorphic flop canonicalization
│   │   │   └── preflop.ts        # preflop stats + flop breakdown
│   │   ├── equity/
│   │   │   ├── rng.ts            # seeded PRNG (xoshiro128**)
│   │   │   ├── handVsHand.ts     # exact enumeration
│   │   │   ├── exactHU.ts        # exact range vs range (sweep algorithm)
│   │   │   ├── monteCarlo.ts     # multiway / preflop range vs range
│   │   │   └── types.ts
│   │   ├── data/
│   │   │   ├── preflopRanking.json   # generated, committed
│   │   │   └── defaultLibrary.json   # starter ranges for the library
│   │   └── index.ts              # public engine API
│   ├── worker/
│   │   ├── engine.worker.ts      # Comlink-exposed EngineApi
│   │   └── client.ts             # job ids, stale-result discard, worker restart
│   └── ui/
│       ├── main.tsx / App.tsx
│       ├── theme.css             # tokens, light + dark
│       ├── state/                # zustand stores: players, board, streets, groups, prefs, history
│       ├── hooks/                # useStats, useEquity, useNextCard … (wrap worker client)
│       ├── hotkeys.ts
│       └── components/
│           ├── RangeMatrix/  ComboSuitPicker/  RangeTextInput/  TopPercentSlider/
│           ├── BoardPicker/  DeadCards/  PlayersPanel/  StreetTimeline/
│           ├── StatsTable/  FilterBar/  StatDetailsPopover/
│           ├── NextCardTable/  EquityPanel/  EquityGraph/  EquityMatrix/  Hotness/
│           ├── GroupsEditor/  GroupPie/  CustomStatBuilder/
│           ├── PreflopStats/  FlopBreakdown/
│           └── RangeLibrary/
└── tests/
    └── e2e/                      # Playwright specs
```

Engine unit tests sit next to the code (`*.test.ts`). Slow exhaustive tests use `*.slow.test.ts`
and run only via `npm run test:slow`.

---

## 4. Core data model

```ts
// cards.ts
type Card = number;                 // 0..51, card = rank * 4 + suit
// rank: 0 = '2' … 8 = 'T' … 12 = 'A'
// suit: 0 = c, 1 = d, 2 = h, 3 = s
rankOf(c) = c >> 2;  suitOf(c) = c & 3;
parseCard('Ah') / parseCard('10h') / formatCard(c)

// combos.ts
type ComboIndex = number;           // 0..1325
// for cards a > b: index = a*(a-1)/2 + b   (max 51*50/2 + 50 = 1325)
COMBO_CARDS: Uint8Array(1326 * 2)   // index → [a, b]
COMBO_INDEX: Int16Array(52 * 52)    // [a][b] → index (symmetric), -1 on a == b
type HandClass = number;            // 0..168
// Matrix: row r, col c in 0..12 with 0 = A … 12 = 2
//   r == c → pair (6 combos)   r < c → suited (4)   r > c → offsuit (12)
CLASS_COMBOS: ComboIndex[][]        // class → its combos
COMBO_CLASS: Uint8Array(1326)

// range.ts
type Range = Float32Array;          // length 1326, weight 0..1 per combo
// Board/dead-card conflicts are applied as a mask at analysis time and
// never written into the stored range, so editing the board is non-destructive.
interface Board { cards: Card[] }   // length 0, 3, 4 or 5

// categorize
interface HandClassification {
  made: MadeId;                     // exactly one (exclusive)
  madeSub: SubId | null;            // e.g. top-pair kicker class
  draws: number;                    // bitmask of DrawId (non-exclusive)
}

// analysis
type Condition =
  | { stat: StatId }                       // built-in or custom stat
  | { suits: SuitPattern }                 // suits operator, e.g. "hole cards contain a heart"
  | { equity: { min: number; max: number } }   // available once equity is computed
  | { and: Condition[] } | { or: Condition[] } | { not: Condition };

interface FilterStep {
  mode: 'keep' | 'remove';
  condition: Condition;
  weight: number;                   // 1 = full; 0.5 = matching combos kept at 50 %
  inverted: boolean;
}

interface Group {                   // colored groups: exclusive, first match wins
  id: string; name: string; color: string;
  condition: Condition; priority: number;
}

interface StreetState {             // one per street after preflop
  boardCards: Card[];               // cards added on this street
  filters: FilterStep[];            // applied in order to produce next street's input range
}
```

---

## 5. Engine design (the hard parts)

### 5.1 Range text format

Grammar (case-insensitive ranks, whitespace ignored):

```
range      := element ("," element)*
element    := "[" number "]" items "[/" number "]"    // weight block, number = percent
            | item (":" weight)?                      // solver style, weight 0..1
items      := item ("," item)*
item       := pair | pair "+" | pair "-" pair
            | twoRanks suitedness? "+"?
            | twoRanks suitedness? "-" twoRanks suitedness?
            | card card                               // specific combo, e.g. AhKh
            | "random" | "any"                        // full 1,326
suitedness := "s" | "o"
```

Semantics: `QQ+` = QQ, KK, AA. `22-55`. `A2s+` = A2s…AKs (the kicker climbs up to one below the top
card). `KTo+` = KTo, KJo, KQo. `K9s-K6s`. `AK` = AKs + AKo.

Serializer: canonical output compresses runs back into `+` / `-` forms and groups equal weights.
`format: 'compact' | 'solver'`, where solver format prints `AA:1,AKs:0.5,AhKh:0.25`. A class with
mixed per-combo weights is written combo by combo.

### 5.2 Hand evaluator

- Input: up to 7 cards. Build four 13-bit suit masks plus a rank-count histogram.
- Flush: any suit mask with popcount ≥ 5 → evaluate within that suit (straight-flush check first).
- Straight: `STRAIGHT_HIGH[8192]` lookup on the OR of the suit masks, with the wheel (A-2-3-4-5)
  handled.
- Pairs/trips/quads from the histogram.
- Output: `category << 20 | r1 << 16 | r2 << 12 | r3 << 8 | r4 << 4 | r5`.
  Categories 0..8 = HighCard, Pair, TwoPair, Trips, Straight, Flush, FullHouse, Quads,
  StraightFlush. A higher value is a better hand, and equal values tie. Unused nibbles are zero
  (for example, a straight stores only its top rank), so each equivalence class has exactly one
  value.
- Hot-path API takes card numbers as separate args or a reused `Uint8Array` so the inner loop
  allocates nothing.

The categorizer does **not** use the evaluator's output. It has its own rank/suit-mask logic,
because stat definitions depend on which cards are hole cards. The evaluator is used for equity
and for the "board plays" check.

### 5.3 Hand categorizer

This module is the core of the product, so every rule must be written in `docs/hand-categories.md`
with examples and pinned by golden tests. Notation: **H** = hole cards, **B** = board (3–5 cards),
**D** = distinct board ranks sorted high→low (D[0] is the top card).

**Made hands**: exclusive. Check them top-down; the first match wins. Together they cover 100 % of
the range.

| Order | Stat | Rule |
|---|---|---|
| 1 | Straight flush | Best hand of H∪B is a straight flush and at least one hole card is among its five cards (wheel counts) |
| 2 | Quads | Four of a kind in H∪B with ≥1 hole card among the four (a kicker alone does not count) |
| 3 | Full house | Best hand is a full house and ≥1 hole card is in its trips or pair part |
| 4 | Flush | ≥5 cards of one suit and ≥1 hole card among the top five cards of that suit |
| 5 | Straight | The best straight in H∪B cannot be formed from B alone |
| 6 | Board plays | River only: `eval(H∪B) == eval(B)`, so neither hole card plays |
| 7 | Set | Pocket pair whose rank appears exactly once on B |
| 8 | Trips | Exactly one hole card matches a rank that appears exactly twice on B |
| 9 | Two pair | Both hole cards (different ranks) each match a rank that appears once on B |
| 10 | Overpair | Pocket pair above D[0] |
| 11 | Top pair | One hole card matches D[0], which appears once on B. Sub-stats: **top kicker** (highest rank not on B and not the pair rank), **good kicker** (next two available ranks), **weak kicker** (rest) |
| 12 | PP below top pair | Pocket pair with D[1] < rank < D[0] (when only one distinct board rank exists, any pocket pair below D[0]) |
| 13 | Middle pair | One hole card matches D[1], with ≥3 distinct board ranks |
| 14 | Weak pair | One hole card matches any lower distinct board rank (D[1] when only 2 distinct ranks, D[2]…), or a pocket pair below D[1] |
| 15 | Ace high | No pair formed with a hole card; at least one hole card is an ace |
| 16 | No made hand | Everything else |

Rules 1–5 use a shared helper, "the category needs a hole card". It compares against the board's
own best category: a board-only straight/flush/full house/quads never gives credit.

**Draws**: non-exclusive bitmask, computed only on the flop and turn, and never for a category the
hand has already made.

| Stat | Rule |
|---|---|
| Flush draw | Some suit has exactly 4 cards in H∪B, including ≥1 hole card, and there is no flush. Sub-stats: **nut FD** (hand holds the highest rank of that suit not on B), **2-card FD**, **1-card FD** |
| Backdoor flush draw (flop) | Some suit has exactly 3 cards in H∪B including ≥1 hole card, and there is no FD. Sub-stats: 2-card / 1-card BDFD |
| No flush draw | Complement of FD + BDFD (Flopzilla Pro exposes this as a separate stat) |
| OESD | `outRanks.size ≥ 2`. `outRanks` = ranks r where adding a card of rank r gives a straight to H∪B and `straightHigh(H∪B∪r) > straightHigh(B∪r)`, i.e. the hole cards are needed. Double gutshots count as OESD |
| Gutshot | `outRanks.size == 1` |
| Backdoor straight draw (flop) | No OESD/gutshot, but some pair of ranks (r1, r2) would complete a straight that needs a hole card |
| Overcards | Made ∈ {Ace high, No made hand} and both hole ranks > D[0] |
| Combo draw (derived) | FD ∧ (OESD ∨ Gutshot) |
| Air (derived) | No made hand ∧ no FD ∧ no OESD ∧ no gutshot |

**Golden test edge cases (must exist):** wheel straights and wheel draws; a straight on the board
at the river (board plays) vs a higher straight that uses a hole card; paired boards (trips vs full
house vs pocket pair below); trips on the board (`777`); quads on the board at the turn; a
four-flush board at the turn (one suited hole card = flush, none = nothing); a monotone flop; nut
flush draw when the suit's ace is on the board (K becomes the nut); a double gutshot classified as
OESD; a four-straight turn board where the hole cards aren't needed (no draw); top-pair kicker
classes when an ace is on the board; two pair where one board rank is paired (→ trips/FH).

These are our own documented definitions. Exact parity with Flopzilla's internals is not a goal,
but each rule can be adjusted later in one place.

### 5.4 Range analysis

- **Effective range on a board:** `weight[i] * (combo i conflicts with board ∪ dead ? 0 : 1)`.
- **Stats:** a single pass over 1,326 combos that skips zero weights. Classify each combo and add
  its weight to its made bucket, each draw bit, and each custom stat. Output per row:
  `combos` (weighted), `pctOfRange`, and the list of combo indices (for mouse-over details and
  overlap).
- **Filters:** `apply(range, board, steps)`. Each step multiplies matching combos (or
  non-matching, when inverted) by `weight` for `keep`, or by `1 − weight` for `remove`. Steps run
  in priority order.
- **Street pipeline:** `range(preflop)` is the user's range. `range(street n+1)` = filters of
  street n applied to `range(street n)`. Changing an earlier street recomputes everything
  downstream. Each street's board = previous board + that street's cards.
- **Next card:** for each unseen card, compute stats on board + card for the current filtered
  range. Output `rows[card][stat]`. It is shown as a table and as a 13×4 card grid heatmap.
- **Groups:** each combo goes to the first group (by priority) whose condition matches. Output:
  per-group combos/% (pie chart), plus per-matrix-cell group proportions (striped cell
  background).

### 5.5 Equity

All jobs accept `Range` per player plus board and dead cards, and return per-combo equities for
the hero, a weighted total, and per-villain totals.

1. **Hand vs hand (any street):** exact enumeration of the remaining board. Preflop that is
   C(48,5) = 1,712,304 boards × 2 evals, which takes under 1 s in a worker.
2. **Exact heads-up range vs range (flop/turn/river): sweep algorithm.** For each runout
   (C(49,2) = 1,176 on the flop, 48 on the turn, 1 on the river):
   - evaluate every live hero and villain combo once (≤ 2 × 1,326 evals);
   - sort both lists by strength;
   - sweep upward, keeping running villain weight totals: `total`, `perCard[52]`, and
     `perCombo[1326]` (for the exact-same-combo correction);
   - for hero combo h = {a, b}, the villain weight below h that doesn't conflict is
     `total − perCard[a] − perCard[b] + perCombo[h]`, handling ties as a group of equal
     strength;
   - accumulate win + tie/2 and the non-conflicting total per hero combo.

   Cost is O(runouts × n log n) instead of O(runouts × n²), well under 1 s for two full ranges
   on the flop.
3. **Monte Carlo (preflop range vs range, and all multiway):** a seeded xoshiro128** PRNG.
   Sample each player's combo by weight (alias table), reject card conflicts, deal the rest of
   the board, evaluate. Stream progress every N iterations with the running standard error. Stop
   at a target error (default 0.1 %) or when cancelled.
4. **Players:** hero + up to 9 villains (`MAX_PLAYERS = 10`, a constant, easy to raise).
5. **Preflop ranking** (for the Top X % slider): `scripts/gen-preflop-ranking.ts` runs each of the
   169 classes vs a random hand (large Monte Carlo, fixed seed). It writes an ordered list to
   `preflopRanking.json`, which is committed. The slider walks this order, accumulating combo
   counts (out of 1,326).

### 5.6 Preflop statistics and flop breakdown

- **Flop texture classifier:** suitedness (rainbow / two-tone / monotone), pairing (unpaired /
  paired / trips), high card (A, K, Q, …), connectivity (straight possible: yes/no; gaps).
- **Preflop stats:** for every flop that doesn't conflict, classify every live combo, and
  accumulate the weighted counts of (stat × texture). Report P(stat), and P(stat ∧ texture),
  e.g. "88 flops an overpair on a rainbow board x %".
- **Flop breakdown:** distribution of textures over all flops, weighted by how many range combos
  are compatible with each flop (card removal). Example from the original's site: "rainbow
  A-high flop 7.17 %".
- **Isomorphism speed-up:** if the range is suit-symmetric (true for any matrix-built range
  without per-suit edits), enumerate only the 1,755 canonical flops with multiplicities (sum =
  22,100). Otherwise enumerate all 22,100 in the worker with progress. Canonical form = the
  lexicographically smallest card list over all 24 suit permutations, computed at worker start.

### 5.7 Worker API

```ts
interface EngineApi {
  stats(req: { range: Float32Array; board: Card[]; dead: Card[];
               customStats: CustomStat[]; groups: Group[] }): StatsResult;
  streets(req: StreetsRequest): StreetsResult;          // filtered range per street + stats
  nextCard(req: NextCardRequest): NextCardResult;
  equity(req: EquityRequest, onProgress?: (p: EquityProgress) => void): Promise<EquityResult>;
  hotness(req: EquityRequest): Promise<HotnessResult>;  // equity delta per next card
  preflopStats(req: PreflopRequest, onProgress?: ProgressFn): Promise<PreflopResult>;
  flopBreakdown(req: PreflopRequest, onProgress?: ProgressFn): Promise<FlopBreakdownResult>;
}
```

- Two workers: a **fast** worker for stats/streets/next card (each well under 100 ms), and a
  **heavy** worker for equity, hotness and preflop jobs.
- Each request carries a `jobId`. The client keeps the latest id per job kind and drops stale
  results. When a heavy job is superseded, the client terminates and recreates the heavy worker,
  so the CPU isn't wasted.
- `Float32Array` buffers are sent as transferables.

---

## 6. UI design

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Players: [Hero] [Villain 1] [+]     Library ▾    Undo Redo     ☾ theme      │
├──────────────────────────┬───────────────────────────────────────────────────┤
│  RANGE MATRIX 13×13      │ STREETS:  Preflop ─▶ Flop [Ks 7d 2c] ─▶ Turn [ ] │
│  (paint / weight brush)  │ Board picker (52-card grid) · Dead cards · Random │
│                          ├───────────────────────────────────────────────────┤
│  Suit picker for the     │ STATS TABLE                     [combos | %]      │
│  selected cell           │  ☐ Set              3   25.0 %  ██               │
│                          │  ☐ Overpair         6   50.0 %  ████             │
│  Range text: [QQ+,AKs ]  │  ☐ Top pair         3   25.0 %  ██               │
│  Top X %: ───●──── 4.5%  │  … draws section …                               │
│  Combos: 12 / 1326       │ Filter: [Keep] [Remove] [Invert] weight [100%]   │
├──────────────────────────┴───────────────────────────────────────────────────┤
│ Tabs: Next card | Equity | Equity graph | Equity matrix | Hotness | Groups   │
│       | Preflop stats | Flop breakdown | Custom stats                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

Interaction rules:

- **Matrix:** left-drag paints at the brush weight, right-drag/shift-drag erases. Cells show
  partial fill proportional to their average weight and group-color stripes when groups are on.
  Hovering shows the class, live combos and weight. Fully keyboard-navigable (arrow keys + Space).
- **Text box ⇄ matrix sync:** edits parse after 150 ms of no typing. Invalid tokens are
  underlined and the last valid range is kept.
- **Board picker:** click cards, or type `Ks7d2c`. Cards already used are disabled. "Random flop"
  respects dead cards.
- **Stats table:** row checkboxes build the selection (OR of rows). Filter buttons append a
  `FilterStep` to the current street. Hovering a row opens a popover listing its combos, grouped
  by hand class. Selecting two rows shows their overlap.
- **Updates are immediate:** every state change triggers fast-worker recomputation. Heavy jobs
  show a progress bar and refine live (Monte Carlo).
- **History:** every range/board/filter edit pushes a snapshot (a range is only 5 KB), capped at
  200 entries, with `Ctrl+Z` / `Ctrl+Shift+Z`.

Zustand store shape:

```ts
{
  players: { id, name, color, range: Float32Array }[];
  activePlayerId: string;
  streets: { flop: StreetState; turn: StreetState; river: StreetState };
  activeStreet: 'preflop' | 'flop' | 'turn' | 'river';
  dead: Card[];
  groups: Group[];  customStats: CustomStat[];
  prefs: { units: 'combos' | 'percent'; theme: 'light' | 'dark' | 'system';
           brushWeight: number; drawHints: boolean };
}
```

---

## 7. Build phases

Each phase ends with: `npm run lint && npm run typecheck && npm test` green, plus the phase's
acceptance criteria. Sizes: S ≈ ½–1 day, M ≈ 2–3 days, L ≈ 4–6 days of focused work.

### Phase 0 — Scaffolding (S) ✅
- [x] Scaffold Vite React-TS (create-vite 9.3.1) in the existing folder; keep `README.md`.
- [x] Add deps: `zustand comlink recharts idb-keyval`. Dev deps: `vitest @vitest/coverage-v8 fast-check
      @playwright/test prettier` (oxlint comes with the template).
- [x] Configs: strict tsconfig, `tsconfig.engine.json` (no DOM lib, no Node types), oxlint
      engine-isolation override, Prettier.
- [x] npm scripts: `dev build preview typecheck lint format format:check test test:watch test:slow
      test:coverage bench e2e`.
- [x] `.gitignore` (node_modules, dist, coverage, playwright-report, test-results, blob-report).
- [x] GitHub Actions CI: lint → format check → typecheck → test → build, plus a Playwright job.

**Done when:** `npm run dev` serves a placeholder page, one sample Vitest test passes, and
`npm run build` succeeds.

### Phase 1 — Cards, combos, ranges, range parser (M)
- [ ] `cards.ts`, `combos.ts` (tables of §4), `range.ts` (create/clear, set class/combo
      weight, weighted combo count, board/dead mask, union/intersect/subtract, equals).
- [ ] `rangeParser.ts`: parse + serialize (compact and solver formats), with error positions.

**Done when:**
- `QQ+` → 18 combos, `AKs` → 4, `AKo` → 12, `AK` → 16, `22+` → 78, `A2s+` → 48, `random` → 1,326.
- `AA` with the Ah on the board → 3 live combos.
- Property tests pass: `parse(serialize(r)) == r` for random weighted ranges, and serialize is
  canonical (idempotent).
- Bad input (`AKx`, `Q2s-K5s`) gives a positioned error.

### Phase 2 — Hand evaluator (M)
- [ ] `tables.ts`, `evaluate.ts` (5/6/7-card), zero-allocation hot path.
- [ ] Vitest bench for evals/sec.

**Done when:**
- Exhaustive 5-card test: 2,598,960 hands give exactly SF 40, quads 624, FH 3,744, flush 5,108,
  straight 10,200, trips 54,912, two pair 123,552, pair 1,098,240, high card 1,302,540, and
  exactly **7,462** distinct values.
- `test:slow` exhaustive 7-card test: 133,784,560 hands give SF 41,584, quads 224,848, FH
  3,473,184, flush 4,047,644, straight 6,180,020, trips 6,461,620, two pair 31,433,400, pair
  58,627,800, high card 23,294,460.
- Bench ≥ 10M 7-card evals/sec in Node 22. If it misses, add a rank-pattern lookup before
  considering WASM.

### Phase 3 — Hand categorizer (L)
- [ ] Write `docs/hand-categories.md` first (rules of §5.3 plus 2–3 examples per stat).
- [ ] `categories.ts` metadata (id, label, section, display order, default color).
- [ ] `madeHand.ts`, `draws.ts`, `classify.ts`.
- [ ] Golden table test of ≥ 80 hand-written cases, covering every edge case listed in §5.3.

**Done when:**
- Golden tests pass.
- Property tests on random ranges/boards pass: made-hand buckets are exclusive and sum to the
  range total; no draws on the river; combos that conflict with the board are never classified.
- Classifying all 1,326 combos on a flop takes < 2 ms (bench).

### Phase 4 — Range analysis engine (M)
- [ ] `conditions.ts`, `stats.ts`, `filters.ts`, `streets.ts`, `nextCard.ts`, `groups.ts`.

**Done when:**
- Range `AA,KK,AKs` on `Ks 7d 2c` gives a total of 12 combos: set 3 (25 %), overpair 6 (50 %),
  top pair 3 (25 %, top kicker).
- Keep "Top pair or better" on the flop, then add a turn card: turn stats use only the filtered
  combos. Editing the flop filter afterwards recomputes the turn.
- Filter weights: a keep step at 50 % halves matching combos. Invert gives the complement.
- Next card: on a flop, there is one row per unseen card (49 minus dead), and each row's made
  buckets sum to that row's live total.
- Groups: every combo is in at most one group, and group totals + "ungrouped" = range total.

### Phase 5 — Equity engine (L)
- [ ] `rng.ts`, `handVsHand.ts`, `exactHU.ts` (sweep), `monteCarlo.ts` (alias sampling,
      progress, cancellation, target std-error).
- [ ] `scripts/gen-preflop-ranking.ts` → `preflopRanking.json` (committed).
- [ ] Worker: `engine.worker.ts` + `client.ts` (job ids, stale discard, heavy-worker restart).

**Done when:**
- `exactHU` matches a brute-force O(n²·runouts) reference to within 1e-9 on 200 random small
  range pairs (flop, turn and river).
- Monte Carlo lands within 3σ of exact on 50 random cases. The same seed gives identical results.
- AA vs KK preflop ≈ 82 / 18, and AKo vs QQ ≈ 43 / 57 (±0.5 %). Optionally cross-checked against
  an independent library (e.g. Python `eval7`) through a one-off fixture script.
- Exact HU equity, full range vs full range on a flop: < 1 s in the worker.

### Phase 6 — UI MVP (L) → **MVP milestone**
- [ ] App shell, theme tokens (light/dark), layout of §6.
- [ ] `RangeMatrix`, `ComboSuitPicker`, `RangeTextInput`, `TopPercentSlider`.
- [ ] `BoardPicker`, `DeadCards`, `StreetTimeline`.
- [ ] `StatsTable` (combos/% toggle, selection), `FilterBar` (keep/remove/invert/weight).
- [ ] Zustand stores, undo/redo, `useStats` hook on the fast worker.
- [ ] Playwright specs for the flows below.

**Done when (E2E):**
- Typing `QQ+,AK` and board `Ks7d2c` shows the correct combo counts (e.g. KK set = 3).
- Painting the matrix updates the text box and stats without pressing any button.
- Selecting "Top pair" + Keep, then adding a turn card, leaves only those combos in the turn
  matrix.
- Undo restores the previous range.
- Stats update in < 50 ms after an edit (measured with a `performance` mark).

### Phase 7 — Equity UI, groups, next card, details (L)
- [ ] `PlayersPanel` (add/remove villains, per-player ranges and colors).
- [ ] `EquityPanel` (totals, per-combo sortable table, exact/MC indicator, progress, Monte Carlo
      toggle).
- [ ] `EquityGraph` (hero combos sorted by equity, x = cumulative % of range, y = equity;
      villain overlay).
- [ ] `EquityMatrix` (13×13 colored by average equity; hover shows per-combo values).
- [ ] `Hotness` (13×4 card grid of equity change per next card).
- [ ] `NextCardTable` (stat % per next card for a chosen stat or group).
- [ ] `GroupsEditor` + `GroupPie`; matrix group stripes; equity-bucket conditions.
- [ ] `StatDetailsPopover` (combos per stat, overlap of two stats); draw hints (outs shown on
      hover).

**Done when:** each view agrees with engine outputs in component tests; an E2E spec runs hero vs
villain equity on a flop and the result matches a fixture; changing the board mid-calculation
cancels the stale job.

### Phase 8 — Preflop stats, flop breakdown, custom stats (M)
- [ ] `texture.ts`, `isomorphism.ts` (1,755 canonical flops, multiplicities sum to 22,100),
      `preflop.ts`.
- [ ] `PreflopStats` and `FlopBreakdown` tabs with progress.
- [ ] `CustomStatBuilder`: AND/OR/NOT tree over built-in stats + suits operator; save, rename,
      reorder, delete. Custom stats show up as stats-table rows and as filter/group conditions.

**Done when:**
- Isomorphic and full enumeration give identical results for symmetric ranges.
- Flop breakdown for the full range matches closed-form texture probabilities: monotone =
  C(4,1)·C(13,3)/C(52,3) ≈ 5.18 %, and paired (exactly one pair) ≈ 16.94 %.
- Preflop stats for a symmetric range finish in < 500 ms.

### Phase 9 — Library, interop, text output, sharing (M)
- [ ] `RangeLibrary`: categories/folders of named ranges, IndexedDB storage, "restore defaults"
      from `defaultLibrary.json`, JSON export/import of the whole library.
- [ ] Solver-format import/export (F17) with paste-detection of the format.
- [ ] Text output: copy stats table / filtered range / equity summary as plain text.
- [ ] Share link: board + ranges + filters encoded in the URL hash (weights quantized to 1 %,
      base64url).
- [ ] Session autosave of the last state (guarded `localStorage`, falls back silently).

**Done when:** a library survives reload; export → import round-trips exactly; a share URL
restores the full state in a fresh browser profile (E2E).

### Phase 10 — Advanced and polish (M–L, pick by priority)
- [ ] Bunching effect: per folded seat, a fold range; the Monte Carlo deals folded hands first.
- [ ] Exact 3-way postflop equity (enumerate runouts; per runout, a pairwise sweep with
      three-way card-removal correction). Fall back to Monte Carlo for 4+ players.
- [ ] Hotkeys (documented in a `?` overlay), notes per saved range, magnification (UI scale).
- [ ] Accessibility pass: color-blind-safe group palette, focus order, ARIA on matrix/grids.
- [ ] Performance pass: profile; port the evaluator/sweep to Rust→WASM only if a target in §9
      is missed.
- [ ] PWA manifest + service worker for offline use; optional Tauri desktop build.

---

## 8. Testing strategy

| Layer | Tooling | What |
|---|---|---|
| Engine unit | Vitest | Parsers, tables, evaluator, categorizer golden cases, filters, sweep equity |
| Engine property | fast-check | Parser round-trips, bucket exclusivity/sums, card-removal invariants, Monte Carlo vs exact |
| Exhaustive | Vitest `*.slow.test.ts` | 5-card (always) and 7-card (`test:slow`) evaluator distributions |
| Benchmarks | `vitest bench` | evals/sec, classify-range, exact HU flop, next-card, preflop stats |
| Components | Vitest + Testing Library | Matrix painting, text sync, stats table selection |
| E2E | Playwright | MVP flows, equity flow, library persistence, share URL |

Rules: the categorizer and equity engine get tests before UI work depends on them. Every bug in a
stat definition becomes a new golden case. Monte Carlo tests always use a fixed seed.

---

## 9. Performance targets

| Operation | Target |
|---|---|
| Stats for a full 1,326-combo range on any board | < 5 ms |
| Next-card table (all turn cards) | < 100 ms |
| Exact HU range vs range — river / turn / flop | < 5 ms / < 50 ms / < 1 s |
| Multiway Monte Carlo, 3 players | std-error ≤ 0.1 % within 2 s |
| Hotness on a flop (exact HU per turn card) | < 2 s |
| Preflop stats — symmetric range (1,755 flops) / asymmetric (22,100) | < 500 ms / < 5 s with progress |
| UI response to an edit (stats visible) | < 50 ms |

---

## 10. Risks and open questions

| Risk | Mitigation |
|---|---|
| Stat definitions differ from what players expect (paired-board edge cases) | `docs/hand-categories.md` + golden tests; each rule is isolated, so changing it is a one-file change |
| Exact equity too slow in JS | Sweep algorithm (§5.5); hard targets in §9; WASM fallback kept behind the same interface |
| Exact multiway equity complexity | Monte Carlo by default with visible std-error; exact 3-way is stretch |
| Scope creep before the core works | Strict MVP cutline at Phase 6; Phases 7–10 only after the MVP E2E suite is green |
| Trademark / IP | Own name, own UI, no copied assets or text |

Open decisions (defaults chosen above, easy to change before Phase 0):
1. **Product name**: working name "Flop Calculator".
2. **Web vs desktop**: web first; Tauri wrapper is optional later.
3. **Player cap**: 10 by default (the original advertises up to 12–14 in multiway mode).
4. **Stat definitions**: our own documented rules (§5.3). Should any rule be tuned to match a
   specific reference tool's output?

---

## 11. Milestone summary

| Milestone | Phases | Result |
|---|---|---|
| M1 — Engine core | 0–3 | Ranges parse, hands evaluate, every combo classified correctly |
| M2 — Analysis + equity engine | 4–5 | Filters, streets, next card, exact/Monte Carlo equity, all in workers |
| **M3 — MVP** | 6 | Usable "classic" tool: matrix, board, instant stats, multi-street filtering |
| M4 — Pro parity | 7–8 | Equity views, groups, hotness, preflop stats, flop breakdown, custom stats |
| M5 — Polish | 9–10 | Library, interop, sharing, bunching, exact 3-way, PWA/desktop |
