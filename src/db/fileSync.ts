import { useGameStore } from '../stores/gameStore.js';
import { useSessionStore } from '../stores/sessionStore.js';
import { useSettingsStore } from '../stores/settingsStore.js';

const STORE_NAMES = ['card-counter-game', 'card-counter-session', 'card-counter-settings'] as const;
const HISTORY_COLLECTIONS = ['sessions', 'shoes', 'hands'] as const;

// --- Hydration (called once at startup, before store creation) ---

export async function hydrateFromFiles(): Promise<void> {
  await Promise.all(
    STORE_NAMES.map(async (name) => {
      try {
        const res = await fetch(`/__data/store/${name}`);
        if (res.ok) {
          const text = await res.text();
          if (text) localStorage.setItem(name, text);
        }
      } catch {
        // File API unavailable — skip silently
      }
    }),
  );
}

export async function hydrateHistoryFromFiles(): Promise<void> {
  // Dynamically import to avoid circular deps and keep historyDb as the single IDB interface
  const { putSession, putShoe, putHand, getAllSessions } = await import('./historyDb.js');

  // Only hydrate if IndexedDB is empty (check sessions as proxy)
  const existing = await getAllSessions();
  if (existing.length > 0) return;

  const fetches = await Promise.all(
    HISTORY_COLLECTIONS.map(async (col) => {
      try {
        const res = await fetch(`/__data/history/${col}`);
        if (res.ok) return { col, data: await res.json() as unknown[] };
      } catch {
        // skip
      }
      return { col, data: [] as unknown[] };
    }),
  );

  for (const { col, data } of fetches) {
    for (const record of data) {
      try {
        if (col === 'sessions') await putSession(record as any);
        else if (col === 'shoes') await putShoe(record as any);
        else if (col === 'hands') await putHand(record as any);
      } catch {
        // skip individual record errors
      }
    }
  }
}

// --- Write-through (ongoing) ---

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function debouncedPut(storeName: string) {
  const existing = debounceTimers.get(storeName);
  if (existing) clearTimeout(existing);

  debounceTimers.set(
    storeName,
    setTimeout(() => {
      debounceTimers.delete(storeName);
      const data = localStorage.getItem(storeName);
      if (data) {
        fetch(`/__data/store/${storeName}`, {
          method: 'PUT',
          body: data,
        }).catch(() => {});
      }
    }, 500),
  );
}

export function initStoreSync(): void {
  useGameStore.subscribe(() => debouncedPut('card-counter-game'));
  useSessionStore.subscribe(() => debouncedPut('card-counter-session'));
  useSettingsStore.subscribe(() => debouncedPut('card-counter-settings'));
}

export function syncRecordToFile(collection: string, record: { id: string }): void {
  fetch(`/__data/history/${collection}`, {
    method: 'PUT',
    body: JSON.stringify(record),
  }).catch(() => {});
}

export function deleteSessionFile(sessionId: string): void {
  fetch(`/__data/history/sessions/${sessionId}`, {
    method: 'DELETE',
  }).catch(() => {});
}
