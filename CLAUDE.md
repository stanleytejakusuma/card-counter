# Card Counter

Blackjack decision HUD for live play. Real-time Hi-Lo counting, basic strategy + Illustrious 18 index deviations, Kelly Criterion bet sizing, persistent session history with hand replay.

## Stack

- Vite + React + TypeScript + Tailwind v4 + Zustand
- Engine layer (`src/engine/`) is pure TS with zero React deps — testable in isolation
- Tests: Vitest (`pnpm test`)
- IndexedDB for persistent history (raw API, no external lib)

## Architecture

```
src/
  engine/          # Pure logic — zero React deps
    types.ts       # Core types (PlayerHand, PlayerSeat, Card, etc.)
    historyTypes.ts # History record types (HandRecord, ShoeRecord, SessionRecord)
    counting.ts    # Hi-Lo, RC→TC, decks remaining
    hand.ts        # Hand total calculation (soft/hard/pair)
    strategy.ts    # Lookup + index deviation resolution
    kelly.ts       # Edge calc + Kelly bet sizing
    tables/        # Strategy tables (S17, H17, Illustrious 18, Fab 4)
  db/              # IndexedDB persistence layer
    historyDb.ts   # Raw IndexedDB wrapper (singleton, lazy-open)
    historyRecorder.ts # Store subscriber → DB writes (fire-and-forget)
  stores/          # Zustand stores
    gameStore.ts   # Running count, seats/hands, split/double, shoe tracking, round history
    sessionStore.ts # Bankroll, bet limits, outcome recording, session stats
    settingsStore.ts # Game rules, stealth mode, wong thresholds
    historyViewStore.ts # History viewer navigation state
  hooks/           # useKeyboard (global hotkeys)
  components/
    HUD/           # TrueCountDisplay, BetDisplay, RunningCount, DecksRemaining
    Strategy/      # StrategyAdvice
    Input/         # CardButtons, CardFeedback, HandDisplay, OutcomePrompt
    Session/       # SessionBar, ShoeProgress
    Layout/        # HUDLayout (3-column), StealthOverlay
    Scoreboard/    # Scoreboard (table visual), RoundHistory (shoe history)
    Guide/         # HowToUse (tabbed reference panel)
    History/       # HistoryOverlay, SessionListView, SessionDetailView, ShoeDetailView, HandDetailView
  utils/           # formatters (currency, TC, date, duration, outcome)
```

## Keyboard Hotkeys

| Key | Action |
|-----|--------|
| `0`, `J`, `Q`, `K` | Input 10-value card |
| `1`-`9` | Input card (1 = Ace) |
| `A` | Input Ace |
| `Tab` | Advance: phase → hand → seat → table |
| `Enter` / `Space` | Confirm hand, next hand |
| `Backspace` | Undo last card (un-split / un-double aware) |
| `Ctrl+Z` | Undo entire current hand |
| `P` | Split hand (pair, 2 cards, max 4 hands/seat) |
| `D` | Double down (2 cards, marks 2x, auto-advance after next card) |
| `S` | New shoe (reset count) |
| `W` | Toggle wong in/out |
| `Shift+1`-`Shift+7` | Toggle seat on/off (idle phase only, max 4 seats) |
| `H` | Toggle history viewer |
| `Escape` | Toggle stealth mode (or close history viewer) |
| `[` | Record win |
| `]` | Record loss |
| `\` | Record push |
| `=` | Record blackjack (3:2) |
| `/` | Record even money (1:1, BJ vs dealer Ace) |
| `-` | Record surrender |
| `Arrow Up/Down` | Navigate history list |

## Commands

- `pnpm dev` — dev server
- `pnpm build` — production build
- `pnpm test` — run tests
- `pnpm test:watch` — watch mode tests

## Key Rules

- Default: 8-deck S17 NDAS (Evolution Gaming standard)
- S17 tables verified against Wizard of Odds 8-deck charts
- True count displayed to 1 decimal, raw float used for threshold comparisons
- All card inputs update running count regardless of hand phase
- Kelly defaults: 1/4 Kelly, $1 unit, $5-100 bet range
- Browser title: "Calculator" (stealth)
- History writes are async fire-and-forget (never block input flow)
- Outcome keys only active during awaitingOutcome state; card keys clear it silently
- History viewer blocks all game keys while open
- 7-seat table model (Evolution Gaming), player occupies up to 4 seats
- Each seat supports 1 split (2 hands max)
- Per-seat bet overrides (null = Kelly default)
- Even money: BJ vs dealer Ace, 1:1 payout
- Split aces auto-advance after 1 card each

## Memory Index

<!-- Auto-managed by /memory command. Keywords link to Cipher memories. -->

### Persistence
- `card-counter-file-persistence`: Vite dev middleware persists localStorage/IndexedDB to JSON files in data/. Hydrate on boot → write-through on change → restore on browser clear.
- `card-counter-sqlite-persistence`: Migrated from JSON to SQLite (better-sqlite3). DB at data/card-counter.db. Normalized schema (stores, sessions, shoes, hands) with cascading deletes, WAL mode. Auto-migrates existing JSON on first open, renames old dirs to .migrated.
- `card-counter-sqlite-fk-migration-fix`: JSON→SQLite migration disables FK checks (PRAGMA foreign_keys = OFF) during transaction to handle orphaned shoes/hands, re-enables after.
- `card-counter-partial-upsert-merge`: PUT handler reads existing DB row and merges incoming fields over it before upsert. Prevents pagehide partial SessionRecord from nullifying startTime/rules.

### Game Logic
- `card-counter-evolution-rules-defaults`: Evolution BJ: 8-deck S17 NDAS, max 1 split (2 hands). settingsStore defaults doubleAfterSplit: false. Strategy engine handles NDAS via Ph → H conditional.
- `card-counter-split-deal-phase`: _splitDealInProgress gates decisions until all split hands get 2nd card. Auto-advances through hands, handles re-splits, undo regresses then merges. Split aces auto-complete. Max 1 split/seat (2 hands).
- `card-counter-multi-seat-play-order`: _dealOrderIndex for round-robin dealing, _activePlaySeat for play-order advancement through player+occupied seats. Phase-aware button layout (deal→play→table→end round).
- `card-counter-auto-outcome`: determineOutcome() in hand.ts computes W/L/P/BJ from player vs dealer totals. Called in confirmHand() with [dealerUpcard, ..._dealerHits]. Auto-records via historyRecorder, skips outcome UI prompt. Player seats only.
- `card-counter-occupied-splits`: Other players can split pairs. _occupiedSplitSeats + _occupiedActiveSubHand state. Cards tagged S{n}.1/S{n}.2. Scoreboard renders split hands with pipe separator. Next/Tab advances sub-hands.
- `card-counter-tc-spread-bet`: TC spread: bet = minBet + (floor(TC) - 1) × unitSize when TC >= 2, else minBet. 1-10 spread on $5 table. calculateSpreadBet() in kelly.ts. Defaults: $5 min, $50 max, $5 unit.
- `card-counter-undo-table-regression`: Undo in table phase with no dealer hits regresses handPhase to 'player', restores _activePlaySeat to last seat in play order. Pure navigation undo, no card removal.
- `card-counter-observe-mode`: Observe round skips player hands, tracks only occupied seat cards for running count. _observeRound + getPlayOrder() helper replaces 8+ hardcoded play order calls. Amber UI button in idle phase.
- `card-counter-getplayorder-recursion-fix`: getPlayOrder() had infinite recursion in non-observe branch. Must return computed value, not call itself. Also: undoCurrentHand() must reset _observeRound to false.
- `card-counter-observe-mode-validation`: Observe constraints: idle + no player seats + ≥1 occupied seat. toggleSeat resets _observeRound. undoLastCard null-checks seat for empty seats. incrementHands skipped for observe rounds.

### UI Features
- `card-counter-occupied-seats`: Scoreboard seats have 3 states (blue=yours, amber=other player, gray=empty). Right-click toggles occupied. gameStore.occupiedSeatNumbers[].
- `card-counter-touch-first-ui`: Keyboard shortcuts removed (useKeyboard gutted). All input via touch/mouse. Draw history strip in CardFeedback with colored chips. Scoreboard dealer in current round section with full hand + total.
- `card-counter-shoes-played-counter`: shoesPlayed in sessionStore, incremented on NEW SHOE press. Shown in SessionBar next to hands count (hidden until first shoe). Reset on resetSession().
- `card-counter-dashboard-analytics`: SessionStats (center column, always visible) shows P&L/winrate/$/hr/hands-hr/hands-shoe. TCBracketStats + ShoeQuality in Analytics panel. tcBrackets + shoePeakTCs in sessionStore (persist v5). trueCount on PendingOutcome. ShoeProgress has % label + amber 75% shuffle zone.
- `card-counter-layout-pin`: Center column flex h-dvh. Info area scrolls (flex-1 overflow-y-auto), CardButtons pinned bottom (flex-shrink-0). Prevents layout shift from InsuranceIndicator/StrategyAdvice/CardFeedback.
