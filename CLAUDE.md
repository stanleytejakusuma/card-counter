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
    types.ts       # Core types
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
    gameStore.ts   # Running count, hand state, card history, shoe tracking
    sessionStore.ts # Bankroll, bet limits, outcome recording, session stats
    settingsStore.ts # Game rules, stealth mode, wong thresholds
    historyViewStore.ts # History viewer navigation state
  hooks/           # useKeyboard (global hotkeys)
  components/
    HUD/           # TrueCountDisplay, BetDisplay, RunningCount, DecksRemaining
    Strategy/      # StrategyAdvice
    Input/         # CardFeedback, HandDisplay, OutcomePrompt
    Session/       # SessionBar, ShoeProgress
    Layout/        # HUDLayout, StealthOverlay
    History/       # HistoryOverlay, SessionListView, SessionDetailView, ShoeDetailView, HandDetailView
  utils/           # formatters (currency, TC, date, duration, outcome)
```

## Keyboard Hotkeys

| Key | Action |
|-----|--------|
| `0`, `J`, `Q`, `K` | Input 10-value card |
| `1`-`9` | Input card (1 = Ace) |
| `A` | Input Ace |
| `Tab` | Toggle dealer/player input |
| `Enter` / `Space` | Confirm hand, next hand |
| `Backspace` | Undo last card |
| `Ctrl+Z` | Undo entire current hand |
| `S` | New shoe (reset count) |
| `W` | Toggle wong in/out |
| `H` | Toggle history viewer |
| `Escape` | Toggle stealth mode (or close history viewer) |
| `[` | Record win (after confirm) |
| `]` | Record loss (after confirm) |
| `\` | Record push (after confirm) |
| `=` | Record blackjack (after confirm) |
| `-` | Record surrender (after confirm) |
| `Arrow Up/Down` | Navigate history list |

## Commands

- `pnpm dev` — dev server
- `pnpm build` — production build
- `pnpm test` — run tests
- `pnpm test:watch` — watch mode tests

## Key Rules

- Default: 8-deck S17 DAS (Evolution Gaming standard)
- S17 tables verified against Wizard of Odds 8-deck charts
- True count displayed to 1 decimal, raw float used for threshold comparisons
- All card inputs update running count regardless of hand phase
- Kelly defaults: 1/4 Kelly, $20 unit, $20-500 bet range
- Browser title: "Calculator" (stealth)
- History writes are async fire-and-forget (never block input flow)
- Outcome keys only active during awaitingOutcome state; card keys clear it silently
- History viewer blocks all game keys while open
