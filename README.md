# Card Counter

Blackjack decision HUD for live play. Real-time Hi-Lo counting, basic strategy with Illustrious 18 index deviations, Kelly Criterion bet sizing, and persistent session history with hand-by-hand replay.

## Prerequisites

- Node.js >= 18
- pnpm

## Installation

```bash
pnpm install
```

## Development

```bash
pnpm dev
```

Opens at `http://localhost:5173`. Browser title shows "Calculator" for stealth.

## Production Build

```bash
pnpm build
pnpm preview
```

## Testing

```bash
pnpm test          # single run
pnpm test:watch    # watch mode
```

## Keyboard Reference

### Card Input

| Key | Card |
|-----|------|
| `1` or `A` | Ace |
| `2`-`9` | Face value |
| `0`, `J`, `Q`, `K` | 10-value |

### Hand Control

| Key | Action |
|-----|--------|
| `Tab` | Toggle dealer/player input |
| `Enter` / `Space` | Confirm hand, next hand |
| `Backspace` | Undo last card |
| `Ctrl+Z` / `Cmd+Z` | Undo entire current hand |

### Outcome Recording (after confirming a hand)

| Key | Outcome |
|-----|---------|
| `[` | Win (+1x bet) |
| `]` | Loss (-1x bet) |
| `\` | Push (0) |
| `=` | Blackjack (+1.5x bet) |
| `-` | Surrender (-0.5x bet) |

Pressing a card key instead of an outcome key skips recording and starts the next hand.

### Session & Navigation

| Key | Action |
|-----|--------|
| `S` | New shoe (reset count) |
| `W` | Toggle wong in/out |
| `H` | Toggle session history viewer |
| `Escape` | Toggle stealth mode (history viewer: close) |
| `Backspace` | Undo last card (history viewer: go back) |
| `Arrow Up/Down` | Navigate history list |
| `Enter` | Drill into selected history item |

## Features

- **Hi-Lo Counting**: Running count, true count, decks remaining
- **Basic Strategy**: S17 and H17 8-deck tables with conditional action resolution
- **Index Deviations**: Illustrious 18 + Fab 4 (when surrender enabled)
- **Kelly Criterion**: Edge-based bet sizing with configurable fraction and limits
- **Session History**: Persistent IndexedDB storage of sessions, shoes, and hands
- **Hand Replay**: Browse past sessions and review individual hand decisions
- **Outcome Tracking**: Record win/loss/push/blackjack/surrender with auto bankroll updates
- **Stealth Mode**: Full-screen black overlay, "Calculator" browser title
- **Wong In/Out**: Track when sitting out

## Cross-Platform Notes

- Works in any modern browser (Chrome, Firefox, Safari, Edge)
- Keyboard shortcuts use standard keys — no OS-specific bindings
- `Ctrl+Z` on Windows/Linux, `Cmd+Z` on Mac for undo hand
- IndexedDB data persists per-browser, per-origin
