# Table Name Per Shoe — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Track which Evolution Gaming table the user plays at, per shoe, with auto-carry forward.

**Architecture:** Add `tableName` string to game store (persisted, carries across shoes), write it into `ShoeRecord` on shoe creation. Editable text input in the Scoreboard TABLE section. Schema migration for SQLite column.

**Tech Stack:** Zustand (gameStore), TypeScript interfaces, SQLite (better-sqlite3), React (Scoreboard component)

---

### Task 1: Add tableName to data model

**Files:**
- Modify: `src/engine/historyTypes.ts:30-40` (ShoeRecord interface)
- Modify: `src/stores/gameStore.ts:101,209,1094-1109,1391-1402` (state + newShoe + partialize)

**Step 1: Add tableName to ShoeRecord**

In `src/engine/historyTypes.ts`, add after `cardDistribution`:

```ts
// line 40, inside ShoeRecord
  tableName?: string;
```

**Step 2: Add tableName to gameStore state + newShoe + partialize**

In `src/stores/gameStore.ts`:

Add to interface (after `shoeHandCount: number;` ~line 102):
```ts
  tableName: string;
```

Add to state action interface (after `newShoe: () => void;` ~line 116):
```ts
  setTableName: (name: string) => void;
```

Add to initial state (after `shoeHandCount: 0,` ~line 210):
```ts
      tableName: '',
```

Add action (after `newShoe` closing ~line 1122):
```ts
      setTableName: (name: string) => set({ tableName: name }),
```

In `newShoe()` (~line 1094): tableName is NOT reset — it auto-carries. No change needed since `newShoe` uses partial `set()` and doesn't touch `tableName`.

In `partialize` (~line 1391), add:
```ts
        tableName: state.tableName,
```

**Step 3: Commit**

```bash
git add src/engine/historyTypes.ts src/stores/gameStore.ts
git commit -m "feat: add tableName to ShoeRecord and gameStore state"
```

---

### Task 2: Write tableName into shoe records

**Files:**
- Modify: `src/db/historyRecorder.ts:287-297` (shoe creation in subscriber)

**Step 1: Pass tableName when creating ShoeRecord**

In `src/db/historyRecorder.ts`, shoe creation block (~line 287):

```ts
        const shoe: ShoeRecord = {
          id: currentShoeId,
          sessionId,
          startTime: Date.now(),
          endTime: null,
          totalHands: 0,
          cardsDealt: 0,
          peakTrueCount: 0,
          minTrueCount: 0,
          tableName: state.tableName || undefined,
        };
```

**Step 2: Commit**

```bash
git add src/db/historyRecorder.ts
git commit -m "feat: write tableName to ShoeRecord on shoe creation"
```

---

### Task 3: SQLite schema migration + field maps

**Files:**
- Modify: `vite-plugin-file-persistence.ts:22-27,41-43,166-173` (SHOE_FIELDS, JSON_FIELDS, migrations)

**Step 1: Add to SHOE_FIELDS**

In `vite-plugin-file-persistence.ts`, SHOE_FIELDS (~line 22):

```ts
  tableName: 'table_name',
```

**Step 2: Add idempotent ALTER TABLE**

In the migrations array (~line 167), add:

```ts
    'ALTER TABLE shoes ADD COLUMN table_name TEXT',
```

**Step 3: Commit**

```bash
git add vite-plugin-file-persistence.ts
git commit -m "feat: SQLite schema migration and field map for table_name"
```

---

### Task 4: Editable table name UI in Scoreboard

**Files:**
- Modify: `src/components/Scoreboard/Scoreboard.tsx:59-64` (TABLE header section)

**Step 1: Add table name input below the TABLE header**

Replace the TABLE header div (~line 62) with:

```tsx
      {/* Table header + name input */}
      <div className="space-y-1.5">
        <div className="text-center text-xs text-neutral-500 font-semibold uppercase tracking-wider">
          Table
        </div>
        <input
          type="text"
          value={tableName}
          onChange={(e) => useGameStore.getState().setTableName(e.target.value)}
          placeholder="Table name..."
          className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-300 placeholder-neutral-600 focus:border-neutral-500 focus:outline-none text-center"
        />
      </div>
```

Add `tableName` to the destructured state (~line 19):

```tsx
  const { seats, playerSeatNumbers, occupiedSeatNumbers, dealerUpcard, handPhase, lastConfirmedRound, shoeRoundHistory, cardContextHistory, _activePlaySeat, _dealerHits, _occupiedSplitSeats, _occupiedActiveSubHand, tableName } = useGameStore();
```

**Step 2: Commit**

```bash
git add src/components/Scoreboard/Scoreboard.tsx
git commit -m "feat: editable table name input in Scoreboard TABLE section"
```

---

### Task 5: Show table name in history views

**Files:**
- Modify: `src/components/History/ShoeDetailView.tsx` (shoe detail)
- Modify: `src/components/History/SessionDetailView.tsx` (session shoe list)

**Step 1: Show tableName in ShoeDetailView**

Add a row showing table name if present (after the existing shoe info rows):

```tsx
{shoe.tableName && (
  <div className="text-xs text-neutral-400">
    <span className="text-neutral-600">Table: </span>{shoe.tableName}
  </div>
)}
```

**Step 2: Show tableName in session's shoe list**

In SessionDetailView, where shoes are listed, append table name if present:

```tsx
{shoe.tableName && (
  <span className="text-neutral-500 ml-1">@ {shoe.tableName}</span>
)}
```

**Step 3: Commit**

```bash
git add src/components/History/ShoeDetailView.tsx src/components/History/SessionDetailView.tsx
git commit -m "feat: display table name in history views"
```

---

### Task 6: Verify and final commit

**Step 1: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors

**Step 2: Run tests**

```bash
pnpm test
```
Expected: all pass (no engine logic changes)

**Step 3: Manual verification**

```bash
pnpm dev
```
- Type table name in Scoreboard input
- Play 1+ hands, press NEW SHOE
- Verify table name persists across shoe change
- Check `data/card-counter.db`: `SELECT table_name FROM shoes`
- Open history viewer, verify table name shows on shoe detail
