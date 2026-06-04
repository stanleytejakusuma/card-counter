# Card Counter — Session Handoff

Companion to `CLAUDE.md` (architecture, hotkey map, rules, memory index). This file tracks **live state** — what's done, what's mid-flight, and the traps waiting for the next session. Read `CLAUDE.md` first for the how; read this for the now.

## Status

Active, dormant since 2026-03-31. Working tree clean on `main`, in sync with `origin/main`. The app is functional and has accumulated real play data (see Current state). No work in progress in git; no uncommitted changes.

## Current state

- **Branch / tree:** `main`, clean (`git status -s` empty), 61 commits, last commit `f76c15e` dated 2026-03-31. Remote `origin/main` tracked.
- **Stack:** Vite 7 + React 19 + TypeScript 5.9 + Tailwind v4 + Zustand 5. Pure-TS engine layer under `src/engine/` (zero React deps). Persistence via a Vite dev-middleware plugin that mirrors localStorage/IndexedDB to SQLite (`better-sqlite3`). See `CLAUDE.md` → Memory Index → Persistence.
- **Live data:** `data/card-counter.db` (SQLite, ~606 KB + a 4 MB WAL, last written 2026-04-09) holds **1,256 hands across 99 shoes and 60 sessions** (verified via `sqlite3 data/card-counter.db`). Note this far exceeds the "~120 hands as of Mar 2026" figure recorded in the `card-counter-data-eval-milestones` memory in `CLAUDE.md` — the memory note is stale; the DB is the source of truth.
- **Tests:** engine-only suite — `counting.test.ts`, `kelly.test.ts`, `strategy.test.ts` (574 lines total) under `src/engine/__tests__/`. No store/component/UI tests. NOTE: `pnpm test` does not run as-is — see Known issues.
- **UI input model:** touch/mouse only. `src/hooks/useKeyboard.ts` is a 3-line no-op (keyboard handling gutted per the `card-counter-touch-first-ui` memory). The keyboard tables in both `README.md` and `CLAUDE.md` describe behavior the code no longer implements.

## Recent work

Dated from `git log` (commit dates) and cross-checked against the `CLAUDE.md` memory index.

- **2026-03-31** (`f76c15e`) — Reordered HUD layout for a decision-first flow; relocated the New Shoe control to prevent misclicks. Last commit.
- **2026-03** (`2fbd5e9`, `e480e32`, `580db4e`, `16eb4d0`) — Iterated bet-spread sizing repeatedly: 2-tier $5-unit → aggressive 3-tier ($10 units, $100 max) → 6-tier linear ramp ($5–$30) with aligned analytics brackets. The bet-sizing tier scheme churned through several designs; the 6-tier ramp is the current state. (Memory `card-counter-tc-spread-bet` documents an earlier 3-tier scheme — verify against `src/engine/kelly.ts` and `BetDisplay.tsx` before trusting any specific numbers.)
- **2026-03** (`0e68370`) — Side-bet win tracking (Perfect Pairs & 21+3) with toggle UI.
- **2026-03** (`41e676e`, `5775d79`) — Bet calc now uses **pre-round** true count (captured before table cards) instead of post-round TC; persist full-granularity data (dealer cards, shoe TC extremes, card distribution). See memory `card-counter-preround-tc-bet-fix`.
- **2026-03** (`d8146b6`) — UI: disabled right-click context menu, differentiated bet colors by tier, enabled resplitting.
- **2026-03-06** (`6554ac4`, `dfa15ed`, then `1832b02`/`108e83c`/`4267a24`/`99ade8b`/`6a36fe5`) — "Table name per shoe" feature: design doc + impl plan (`docs/plans/2026-03-06-*.md`), then `tableName` threaded through `ShoeRecord`, `gameStore`, a SQLite `ALTER TABLE shoes ADD COLUMN table_name` migration, an editable Scoreboard input, and display in history views.
- **Earlier 2026-03** — SQLite migration from the original JSON file-persistence, plus a string of multi-seat / split / observe-mode / undo correctness fixes. The full chain is captured in the `CLAUDE.md` Memory Index under Game Logic and Persistence.

## In-flight / Next

No git branch or uncommitted work is in progress. Candidate next steps, grounded in the evidence:

- **Re-run the TC-bracket data gut-check.** The `card-counter-data-eval-milestones` memory sets 500–1,000 hands as the threshold for an initial win-rate / avg-bet-per-tier sanity check and 5,000+ for statistically significant spread validation. The DB now holds 1,256 hands — past the first milestone, so an initial analysis is actionable; not yet at the significance bar. (Whether such an analysis was already run is unknown — TODO/verify against any notebook or query output not present in this repo.)
- **Reconcile stale docs with the touch-first reality** (see Known issues) — low effort, high clarity payoff.
- The "table name per shoe" feature appears fully shipped (design → plan → 5 implementation commits → display). No open follow-up is recorded. TODO/verify if any analytics-by-table view was intended beyond raw capture.

## Known issues / gotchas

- **`pnpm test` fails out of the box — stale/partial `node_modules`.** `vitest run` throws `Cannot find module .../node_modules/vitest/vitest.mjs` even though `node_modules/vitest/` and `node_modules/.bin/vitest` both exist. The install is corrupted/partial (likely Syncthing-mangled symlinks — `node_modules` is gitignored but lives in a synced tree). Fix: `pnpm install --force` before running tests or `pnpm dev`. Also note the local Node is **v25.5.0**, far ahead of the README's stated `>= 18` floor — rule that in/out if a clean reinstall still misbehaves.
- **Syncthing sync-conflict artifacts in `data/`.** `data/card-counter.sync-conflict-20260314-113636-T32I75J.db-shm` and a `data/conflicts_backup/` directory exist — residue from syncing a live SQLite DB (WAL/SHM files) across machines. SQLite + Syncthing is a known-bad combination; the DB can be corrupted by concurrent writes on two hosts. Treat `data/card-counter.db` as the canonical copy, back it up before any reinstall, and do not run the dev server on two machines at once. `data/` is gitignored, so this data exists only locally.
- **Keyboard docs are stale.** `README.md` has a full "Keyboard Reference" section and `CLAUDE.md` has a hotkey table, but `useKeyboard.ts` is a no-op and the UI is touch/mouse only. Anyone trusting those tables will be confused. Per the do-not-touch rule, `CLAUDE.md` is left as-is; flag this for Stanley to decide whether to prune both.
- **Memory hand-count is stale.** The `card-counter-data-eval-milestones` memory says "~120 hands as of Mar 2026"; the live DB has 1,256. Trust the DB, not the note.
- **`dist/` is a stale build artifact** (gitignored, last built 2026-03-05). Rebuild with `pnpm build` rather than trusting its contents.

## Key files & entry points

- `src/main.tsx`, `src/App.tsx` — React entry.
- `vite.config.ts` + `vite-plugin-file-persistence.ts` (repo root, ~16 KB) — the dev-middleware that mirrors store state to SQLite. The persistence story lives here, not in app code.
- `src/db/fileSync.ts` — client side of persistence: `hydrateFromFiles()` on boot, write-through to `/__data/...` endpoints served by the Vite plugin.
- `src/db/historyDb.ts`, `src/db/historyRecorder.ts` — IndexedDB wrapper + fire-and-forget store subscriber.
- `src/engine/` — pure logic: `counting.ts` (Hi-Lo RC→TC), `hand.ts` (totals + `determineOutcome`), `strategy.ts` (basic strategy + index deviations), `kelly.ts` (edge + bet sizing), `tables/` (S17/H17 charts, Illustrious 18, Fab 4). This is the testable core.
- `src/stores/` — `gameStore.ts` (count, seats/hands, splits/doubles, shoe + round history — the largest store), `sessionStore.ts` (bankroll, bet limits, outcomes, stats), `settingsStore.ts` (rules, stealth, wong), `historyViewStore.ts`.
- `src/engine/__tests__/` — the only test coverage.
- `docs/plans/2026-03-06-table-name-{design,plan}.md` — the one feature with written design docs.
- `data/card-counter.db` — live SQLite play data (gitignored, local-only).

### Commands

- `pnpm install --force` — fix the broken `node_modules` first (see gotchas).
- `pnpm dev` — dev server at `http://localhost:5173` (also starts the file-persistence middleware).
- `pnpm build` — `tsc -b && vite build`.
- `pnpm test` / `pnpm test:watch` — engine tests (only works after a clean install).
- `pnpm lint` — ESLint.
