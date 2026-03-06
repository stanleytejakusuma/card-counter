# Table Name Per Shoe

## Problem

No way to track which Evolution Gaming table was played. All shoes/hands are anonymous. Can't analyze performance by table or track penetration quality across tables.

## Design

Add `tableName` (free text) to shoes. Carries forward on NEW SHOE. Editable in UI.

### Data Model

- `ShoeRecord.tableName?: string`
- `gameStore.tableName: string` (persisted, carries across shoes)
- SQLite: `ALTER TABLE shoes ADD COLUMN table_name TEXT` (idempotent)
- Vite plugin: add to `SHOE_FIELDS` map

### UI

- Small editable text field near the TABLE section (top-right panel)
- Shows current table name, tap to edit
- On NEW SHOE: previous table name auto-carries (no re-typing)
- Empty by default (optional field)

### History

- Shoe detail view shows table name
- Session detail shows table names per shoe

### Future (not in scope)

- Auto-associate rules with table names
- Penetration analytics per table (derivable from existing `cardsDealt`)
- Recent tables dropdown (auto-populated from history)

## Approved

2026-03-06
