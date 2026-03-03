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

- Default: 8-deck S17 DAS (Evolution Gaming standard)
- S17 tables verified against Wizard of Odds 8-deck charts
- True count displayed to 1 decimal, raw float used for threshold comparisons
- All card inputs update running count regardless of hand phase
- Kelly defaults: 1/4 Kelly, $1 unit, $5-100 bet range
- Browser title: "Calculator" (stealth)
- History writes are async fire-and-forget (never block input flow)
- Outcome keys only active during awaitingOutcome state; card keys clear it silently
- History viewer blocks all game keys while open
- 7-seat table model (Evolution Gaming), player occupies up to 4 seats
- Each seat supports up to 4 hands from splits
- Per-seat bet overrides (null = Kelly default)
- Even money: BJ vs dealer Ace, 1:1 payout
- Split aces auto-advance after 1 card each

## Memory Index

<!-- Auto-managed by /memory command. Keywords link to Cipher memories. -->

### Persistence
- `card-counter-file-persistence`: Vite dev middleware persists localStorage/IndexedDB to JSON files in data/. Hydrate on boot → write-through on change → restore on browser clear.

### UI Features
- `card-counter-occupied-seats`: Scoreboard seats have 3 states (blue=yours, amber=other player, gray=empty). Right-click toggles occupied. gameStore.occupiedSeatNumbers[].
