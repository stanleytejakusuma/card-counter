import type { HandRecord, ShoeRecord, SessionRecord } from '../engine/historyTypes.js';
import { syncRecordToFile, deleteSessionFile } from './fileSync.js';

const DB_NAME = 'card-counter-history';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains('hands')) {
        const hands = db.createObjectStore('hands', { keyPath: 'id' });
        hands.createIndex('shoeId', 'shoeId', { unique: false });
        hands.createIndex('sessionId', 'sessionId', { unique: false });
        hands.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains('shoes')) {
        const shoes = db.createObjectStore('shoes', { keyPath: 'id' });
        shoes.createIndex('sessionId', 'sessionId', { unique: false });
        shoes.createIndex('startTime', 'startTime', { unique: false });
      }

      if (!db.objectStoreNames.contains('sessions')) {
        const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
        sessions.createIndex('startTime', 'startTime', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

function txPut<T>(storeName: string, record: T): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

function txGet<T>(storeName: string, key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
      }),
  );
}

function txGetAllByIndex<T>(storeName: string, indexName: string, key: string): Promise<T[]> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).index(indexName).getAll(key);
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
      }),
  );
}

function txGetAll<T>(storeName: string): Promise<T[]> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
      }),
  );
}

// --- Writes ---

export function putSession(record: SessionRecord): Promise<void> {
  return txPut('sessions', record).then(() => syncRecordToFile('sessions', record));
}

export function putShoe(record: ShoeRecord): Promise<void> {
  return txPut('shoes', record).then(() => syncRecordToFile('shoes', record));
}

export function putHand(record: HandRecord): Promise<void> {
  return txPut('hands', record).then(() => syncRecordToFile('hands', record));
}

export function updateHandOutcome(
  handId: string,
  outcome: HandRecord['outcome'],
  betAmount: number,
  netResult: number,
): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction('hands', 'readwrite');
        const store = tx.objectStore('hands');
        const req = store.get(handId);
        req.onsuccess = () => {
          const hand = req.result as HandRecord | undefined;
          if (hand) {
            hand.outcome = outcome;
            hand.betAmount = betAmount;
            hand.netResult = netResult;
            store.put(hand);
          }
          tx.oncomplete = () => {
            if (hand) syncRecordToFile('hands', hand);
            resolve();
          };
        };
        tx.onerror = () => reject(tx.error);
      }),
  );
}

export function updateShoeEnd(
  shoeId: string,
  endTime: number,
  totalHands: number,
  cardsDealt: number,
  peakTrueCount?: number,
  minTrueCount?: number,
  cardDistribution?: Record<string, number>,
): Promise<void> {
  return txGet<ShoeRecord>('shoes', shoeId).then((shoe) => {
    if (shoe) {
      shoe.endTime = endTime;
      shoe.totalHands = totalHands;
      shoe.cardsDealt = cardsDealt;
      if (peakTrueCount != null) shoe.peakTrueCount = peakTrueCount;
      if (minTrueCount != null) shoe.minTrueCount = minTrueCount;
      if (cardDistribution) shoe.cardDistribution = cardDistribution;
      return txPut('shoes', shoe).then(() => syncRecordToFile('shoes', shoe));
    }
  });
}

export function updateSessionEnd(
  sessionId: string,
  endTime: number,
  endingBankroll: number,
  stats: {
    totalHands: number;
    totalShoes: number;
    handsWon: number;
    handsLost: number;
    handsPushed: number;
    blackjacks: number;
    deviationsTaken: number;
  },
): Promise<void> {
  return txGet<SessionRecord>('sessions', sessionId).then((session) => {
    if (session) {
      session.endTime = endTime;
      session.endingBankroll = endingBankroll;
      session.netPnL = endingBankroll - session.startingBankroll;
      Object.assign(session, stats);
      return txPut('sessions', session).then(() => syncRecordToFile('sessions', session));
    }
  });
}

// --- Reads ---

export function getAllSessions(): Promise<SessionRecord[]> {
  return txGetAll<SessionRecord>('sessions');
}

export function getShoesBySession(sessionId: string): Promise<ShoeRecord[]> {
  return txGetAllByIndex<ShoeRecord>('shoes', 'sessionId', sessionId);
}

export function getHandsBySession(sessionId: string): Promise<HandRecord[]> {
  return txGetAllByIndex<HandRecord>('hands', 'sessionId', sessionId);
}

export function getHandsByShoe(shoeId: string): Promise<HandRecord[]> {
  return txGetAllByIndex<HandRecord>('hands', 'shoeId', shoeId);
}

export function getHandById(handId: string): Promise<HandRecord | undefined> {
  return txGet<HandRecord>('hands', handId);
}

export function updateHandSideBets(
  handId: string,
  sideBetWins: { pp?: boolean; twentyOneThree?: boolean },
): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction('hands', 'readwrite');
        const store = tx.objectStore('hands');
        const req = store.get(handId);
        req.onsuccess = () => {
          const hand = req.result as HandRecord | undefined;
          if (hand) {
            hand.sideBetWins = sideBetWins;
            store.put(hand);
          }
          tx.oncomplete = () => {
            if (hand) syncRecordToFile('hands', hand);
            resolve();
          };
        };
        tx.onerror = () => reject(tx.error);
      }),
  );
}

// --- Delete ---

export function deleteSession(sessionId: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(['sessions', 'shoes', 'hands'], 'readwrite');

        // Delete session
        tx.objectStore('sessions').delete(sessionId);

        // Delete shoes by session
        const shoeIdx = tx.objectStore('shoes').index('sessionId');
        const shoeReq = shoeIdx.openCursor(sessionId);
        shoeReq.onsuccess = () => {
          const cursor = shoeReq.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };

        // Delete hands by session
        const handIdx = tx.objectStore('hands').index('sessionId');
        const handReq = handIdx.openCursor(sessionId);
        handReq.onsuccess = () => {
          const cursor = handReq.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };

        tx.oncomplete = () => {
          deleteSessionFile(sessionId);
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      }),
  );
}
