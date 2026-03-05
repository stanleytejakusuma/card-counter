import type { Plugin } from 'vite';
import Database from 'better-sqlite3';
import { readFileSync, existsSync, renameSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

const DATA_DIR = 'data';
const DB_PATH = join(DATA_DIR, 'card-counter.db');
const STORES_DIR = join(DATA_DIR, 'stores');
const HISTORY_DIR = join(DATA_DIR, 'history');

// camelCase <-> snake_case field maps per table
const SESSION_FIELDS: Record<string, string> = {
  id: 'id', startTime: 'start_time', endTime: 'end_time',
  startingBankroll: 'starting_bankroll', endingBankroll: 'ending_bankroll',
  netPnL: 'net_pnl', totalHands: 'total_hands', totalShoes: 'total_shoes',
  rules: 'rules', handsWon: 'hands_won', handsLost: 'hands_lost',
  handsPushed: 'hands_pushed', blackjacks: 'blackjacks',
  deviationsTaken: 'deviations_taken',
};

const SHOE_FIELDS: Record<string, string> = {
  id: 'id', sessionId: 'session_id', startTime: 'start_time',
  endTime: 'end_time', totalHands: 'total_hands', cardsDealt: 'cards_dealt',
  peakTrueCount: 'peak_true_count', minTrueCount: 'min_true_count',
  cardDistribution: 'card_distribution',
};

const HAND_FIELDS: Record<string, string> = {
  id: 'id', sessionId: 'session_id', shoeId: 'shoe_id',
  handNumber: 'hand_number', timestamp: 'timestamp',
  dealerUpcard: 'dealer_upcard', playerCards: 'player_cards',
  handTotal: 'hand_total', runningCount: 'running_count',
  trueCount: 'true_count', decksRemaining: 'decks_remaining',
  strategyAdvice: 'strategy_advice', betRecommendation: 'bet_recommendation',
  outcome: 'outcome', betAmount: 'bet_amount', netResult: 'net_result',
  boxIndex: 'box_index', seatNumber: 'seat_number', handIndex: 'hand_index',
  doubled: 'doubled', fromSplit: 'from_split',
  dealerCards: 'dealer_cards',
};

// Fields that contain JSON objects/arrays
const JSON_FIELDS = new Set(['rules', 'dealerUpcard', 'playerCards', 'dealerCards', 'cardDistribution']);
// Boolean fields stored as 0/1/null
const BOOL_FIELDS = new Set(['doubled', 'fromSplit']);

// Reverse maps (snake -> camel)
function invertMap(m: Record<string, string>): Record<string, string> {
  const inv: Record<string, string> = {};
  for (const [k, v] of Object.entries(m)) inv[v] = k;
  return inv;
}
const SESSION_FIELDS_REV = invertMap(SESSION_FIELDS);
const SHOE_FIELDS_REV = invertMap(SHOE_FIELDS);
const HAND_FIELDS_REV = invertMap(HAND_FIELDS);

/** Convert a camelCase JS object to snake_case DB row */
function toRow(obj: Record<string, unknown>, fieldMap: Record<string, string>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [camel, snake] of Object.entries(fieldMap)) {
    let val = obj[camel];
    if (val === undefined) val = null;
    if (JSON_FIELDS.has(camel) && val != null) val = JSON.stringify(val);
    if (BOOL_FIELDS.has(camel)) val = val == null ? null : val ? 1 : 0;
    row[snake] = val;
  }
  return row;
}

/** Convert a snake_case DB row to camelCase JS object */
function fromRow(row: Record<string, unknown>, revMap: Record<string, string>): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [snake, camel] of Object.entries(revMap)) {
    let val = row[snake];
    if (JSON_FIELDS.has(camel) && typeof val === 'string') {
      try { val = JSON.parse(val); } catch { /* keep as string */ }
    }
    if (BOOL_FIELDS.has(camel)) val = val == null ? null : val === 1;
    obj[camel] = val;
  }
  return obj;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function initDb(): Database.Database {
  mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS stores (
      name TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      start_time INTEGER,
      end_time INTEGER,
      starting_bankroll REAL DEFAULT 0,
      ending_bankroll REAL,
      net_pnl REAL,
      total_hands INTEGER DEFAULT 0,
      total_shoes INTEGER DEFAULT 0,
      rules TEXT,
      hands_won INTEGER DEFAULT 0,
      hands_lost INTEGER DEFAULT 0,
      hands_pushed INTEGER DEFAULT 0,
      blackjacks INTEGER DEFAULT 0,
      deviations_taken INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS shoes (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
      start_time INTEGER,
      end_time INTEGER,
      total_hands INTEGER DEFAULT 0,
      cards_dealt INTEGER DEFAULT 0,
      peak_true_count REAL DEFAULT 0,
      min_true_count REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS hands (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
      shoe_id TEXT REFERENCES shoes(id) ON DELETE CASCADE,
      hand_number INTEGER,
      timestamp INTEGER,
      dealer_upcard TEXT,
      player_cards TEXT,
      hand_total INTEGER,
      running_count INTEGER,
      true_count REAL,
      decks_remaining REAL,
      strategy_advice TEXT,
      bet_recommendation REAL,
      outcome TEXT,
      bet_amount REAL,
      net_result REAL,
      box_index INTEGER,
      seat_number INTEGER,
      hand_index INTEGER,
      doubled INTEGER,
      from_split INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_shoes_session ON shoes(session_id);
    CREATE INDEX IF NOT EXISTS idx_hands_session ON hands(session_id);
    CREATE INDEX IF NOT EXISTS idx_hands_shoe ON hands(shoe_id);
    CREATE INDEX IF NOT EXISTS idx_hands_timestamp ON hands(timestamp);
  `);

  // Idempotent schema migrations for new columns
  const migrations = [
    'ALTER TABLE hands ADD COLUMN dealer_cards TEXT',
    'ALTER TABLE shoes ADD COLUMN card_distribution TEXT',
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }

  return db;
}

function readJsonFileContent(path: string): string | null {
  try {
    if (!existsSync(path)) return null;
    return readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
}

function readJsonArray<T>(path: string): T[] {
  const raw = readJsonFileContent(path);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function migrateJsonToSqlite(db: Database.Database) {
  // Check if already migrated
  const meta = db.prepare('SELECT data FROM stores WHERE name = ?').get('_meta') as { data: string } | undefined;
  if (meta) {
    try {
      const flags = JSON.parse(meta.data);
      if (flags.json_migrated) return;
    } catch { /* continue */ }
  }

  const hasJsonData = existsSync(STORES_DIR) || existsSync(HISTORY_DIR);
  if (!hasJsonData) {
    // No JSON to migrate, just set the flag
    db.prepare('INSERT OR REPLACE INTO stores (name, data) VALUES (?, ?)').run('_meta', JSON.stringify({ json_migrated: true }));
    return;
  }

  console.log('[file-persistence] Migrating JSON data to SQLite...');

  // Temporarily disable FK checks — JSON data may have orphaned shoes/hands
  db.pragma('foreign_keys = OFF');

  const migrate = db.transaction(() => {
    // Migrate stores
    if (existsSync(STORES_DIR)) {
      const storeFiles = ['card-counter-game', 'card-counter-session'];
      for (const name of storeFiles) {
        const raw = readJsonFileContent(join(STORES_DIR, `${name}.json`));
        if (raw) {
          db.prepare('INSERT OR REPLACE INTO stores (name, data) VALUES (?, ?)').run(name, raw);
        }
      }
    }

    // Migrate sessions
    const sessions = readJsonArray<Record<string, unknown>>(join(HISTORY_DIR, 'sessions.json'));
    if (sessions.length > 0) {
      const cols = Object.values(SESSION_FIELDS);
      const placeholders = cols.map(() => '?').join(', ');
      const stmt = db.prepare(`INSERT OR REPLACE INTO sessions (${cols.join(', ')}) VALUES (${placeholders})`);
      for (const s of sessions) {
        const row = toRow(s, SESSION_FIELDS);
        stmt.run(...cols.map(c => row[c]));
      }
      console.log(`[file-persistence]   Migrated ${sessions.length} sessions`);
    }

    // Migrate shoes
    const shoes = readJsonArray<Record<string, unknown>>(join(HISTORY_DIR, 'shoes.json'));
    if (shoes.length > 0) {
      const cols = Object.values(SHOE_FIELDS);
      const placeholders = cols.map(() => '?').join(', ');
      const stmt = db.prepare(`INSERT OR REPLACE INTO shoes (${cols.join(', ')}) VALUES (${placeholders})`);
      for (const s of shoes) {
        const row = toRow(s, SHOE_FIELDS);
        stmt.run(...cols.map(c => row[c]));
      }
      console.log(`[file-persistence]   Migrated ${shoes.length} shoes`);
    }

    // Migrate hands
    const hands = readJsonArray<Record<string, unknown>>(join(HISTORY_DIR, 'hands.json'));
    if (hands.length > 0) {
      const cols = Object.values(HAND_FIELDS);
      const placeholders = cols.map(() => '?').join(', ');
      const stmt = db.prepare(`INSERT OR REPLACE INTO hands (${cols.join(', ')}) VALUES (${placeholders})`);
      for (const h of hands) {
        const row = toRow(h, HAND_FIELDS);
        stmt.run(...cols.map(c => row[c]));
      }
      console.log(`[file-persistence]   Migrated ${hands.length} hands`);
    }

    // Set migration flag
    db.prepare('INSERT OR REPLACE INTO stores (name, data) VALUES (?, ?)').run('_meta', JSON.stringify({ json_migrated: true }));
  });

  try {
    migrate();
  } finally {
    // Re-enable FK checks even if migration throws
    db.pragma('foreign_keys = ON');
  }

  // Rename old directories
  if (existsSync(STORES_DIR)) {
    renameSync(STORES_DIR, join(DATA_DIR, 'stores.migrated'));
    console.log('[file-persistence]   Renamed data/stores/ -> data/stores.migrated/');
  }
  if (existsSync(HISTORY_DIR)) {
    renameSync(HISTORY_DIR, join(DATA_DIR, 'history.migrated'));
    console.log('[file-persistence]   Renamed data/history/ -> data/history.migrated/');
  }

  console.log('[file-persistence] Migration complete.');
}

// Allowlisted table names for dynamic SQL
const VALID_TABLES = new Set(['sessions', 'shoes', 'hands']);

export default function filePersistencePlugin(): Plugin {
  let db: Database.Database;

  return {
    name: 'file-persistence',
    configureServer(server) {
      db = initDb();
      migrateJsonToSqlite(db);

      // Build upsert statements
      function buildUpsert(table: string, fieldMap: Record<string, string>): Database.Statement {
        const cols = Object.values(fieldMap);
        const placeholders = cols.map(() => '?').join(', ');
        const updates = cols.filter(c => c !== 'id').map(c => `${c} = excluded.${c}`).join(', ');
        return db.prepare(
          `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`
        );
      }

      const tableConfig: Record<string, {
        fieldMap: Record<string, string>;
        revMap: Record<string, string>;
        upsert: Database.Statement;
      }> = {
        sessions: { fieldMap: SESSION_FIELDS, revMap: SESSION_FIELDS_REV, upsert: buildUpsert('sessions', SESSION_FIELDS) },
        shoes: { fieldMap: SHOE_FIELDS, revMap: SHOE_FIELDS_REV, upsert: buildUpsert('shoes', SHOE_FIELDS) },
        hands: { fieldMap: HAND_FIELDS, revMap: HAND_FIELDS_REV, upsert: buildUpsert('hands', HAND_FIELDS) },
      };

      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url ?? '';
        const method = req.method ?? 'GET';

        // --- Store endpoints ---
        const storeMatch = url.match(/^\/__data\/store\/([a-zA-Z0-9_-]+)$/);
        if (storeMatch) {
          const name = storeMatch[1];

          if (method === 'GET') {
            const row = db.prepare('SELECT data FROM stores WHERE name = ?').get(name) as { data: string } | undefined;
            if (!row) {
              json(res, 404, { error: 'not found' });
            } else {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(row.data);
            }
            return;
          }

          if (method === 'PUT') {
            const body = await readBody(req);
            db.prepare('INSERT OR REPLACE INTO stores (name, data) VALUES (?, ?)').run(name, body);
            json(res, 200, { ok: true });
            return;
          }
        }

        // --- History collection endpoints ---
        const historyMatch = url.match(/^\/__data\/history\/([a-zA-Z0-9_-]+)$/);
        if (historyMatch) {
          const collection = historyMatch[1];
          if (!VALID_TABLES.has(collection)) { next(); return; }
          const table = tableConfig[collection];

          if (method === 'GET') {
            const rows = db.prepare(`SELECT * FROM ${collection}`).all() as Record<string, unknown>[];
            const result = rows.map(r => fromRow(r, table.revMap));
            json(res, 200, result);
            return;
          }

          if (method === 'PUT') {
            const body = await readBody(req);
            const incoming = JSON.parse(body) as Record<string, unknown>;

            // Merge with existing row to preserve fields not in the payload
            // (e.g. pagehide sends partial SessionRecord missing startTime/rules)
            if (incoming.id) {
              const existingRow = db.prepare(`SELECT * FROM ${collection} WHERE id = ?`).get(incoming.id as string) as Record<string, unknown> | undefined;
              if (existingRow) {
                const existing = fromRow(existingRow, table.revMap);
                for (const key of Object.keys(existing)) {
                  if (!(key in incoming)) incoming[key] = existing[key];
                }
              }
            }

            const row = toRow(incoming, table.fieldMap);
            const cols = Object.values(table.fieldMap);
            try {
              table.upsert.run(...cols.map(c => row[c]));
            } catch (e: unknown) {
              const sqlErr = e as { code?: string };
              if (sqlErr.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
                // Parent row (session/shoe) may not exist yet — create placeholder and retry
                if (collection === 'shoes' || collection === 'hands') {
                  const sid = row.session_id;
                  if (sid) db.prepare('INSERT OR IGNORE INTO sessions (id) VALUES (?)').run(sid);
                }
                if (collection === 'hands') {
                  const shoeId = row.shoe_id;
                  if (shoeId) db.prepare('INSERT OR IGNORE INTO shoes (id, session_id) VALUES (?, ?)').run(shoeId, row.session_id);
                }
                table.upsert.run(...cols.map(c => row[c]));
              } else {
                throw e;
              }
            }
            json(res, 200, { ok: true });
            return;
          }
        }

        // --- Cascade delete session ---
        const deleteMatch = url.match(/^\/__data\/history\/sessions\/([a-zA-Z0-9_-]+)$/);
        if (deleteMatch && method === 'DELETE') {
          const sessionId = deleteMatch[1];
          // ON DELETE CASCADE handles shoes and hands automatically
          db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
          json(res, 200, { ok: true });
          return;
        }

        next();
      });
    },
  };
}
