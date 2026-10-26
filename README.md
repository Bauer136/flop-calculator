# Flop Calculator

Browser-based poker range analysis: enter ranges and a board, see how each range hits (made hands
and draws), filter street by street, and compute equity. See [BUILD_PLAN.md](BUILD_PLAN.md) for the
full plan.

## Development

Requires Node 22+.

```sh
npm install
npm run dev            # dev server at http://localhost:5173
```

| Script | What it does |
|---|---|
| `npm run build` | Typecheck and build to `dist/` |
| `npm run typecheck` | `tsc -b` across app, engine and tooling configs |
| `npm run lint` | oxlint, including the engine-isolation rule |
| `npm run format` / `format:check` | Prettier |
| `npm test` | Unit and property tests (Vitest) |
| `npm run test:slow` | Exhaustive tests (`*.slow.test.ts`) |
| `npm run test:coverage` | Unit tests with engine coverage |
| `npm run bench` | Benchmarks (`*.bench.ts`) |
| `npm run e2e` | Playwright tests against the production build (first run: `npx playwright install chromium`) |

`src/engine/` must stay pure TypeScript: no React, DOM, Node globals, or imports from `src/ui` /
`src/worker`. Lint and `tsconfig.engine.json` enforce this.
