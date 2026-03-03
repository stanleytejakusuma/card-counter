import type { Plugin } from 'vite';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

const DATA_DIR = 'data';
const STORES_DIR = join(DATA_DIR, 'stores');
const HISTORY_DIR = join(DATA_DIR, 'history');

function ensureDirs() {
  mkdirSync(STORES_DIR, { recursive: true });
  mkdirSync(HISTORY_DIR, { recursive: true });
}

function readJsonFile(path: string): string | null {
  try {
    if (!existsSync(path)) return null;
    return readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
}

function readJsonArray<T>(path: string): T[] {
  const raw = readJsonFile(path);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJson(path: string, data: unknown) {
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
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

export default function filePersistencePlugin(): Plugin {
  return {
    name: 'file-persistence',
    configureServer(server) {
      ensureDirs();

      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url ?? '';
        const method = req.method ?? 'GET';

        // --- Store endpoints ---
        const storeMatch = url.match(/^\/__data\/store\/([a-zA-Z0-9_-]+)$/);
        if (storeMatch) {
          const name = storeMatch[1];
          const filePath = join(STORES_DIR, `${name}.json`);

          if (method === 'GET') {
            const raw = readJsonFile(filePath);
            if (raw === null) {
              json(res, 404, { error: 'not found' });
            } else {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(raw);
            }
            return;
          }

          if (method === 'PUT') {
            const body = await readBody(req);
            writeFileSync(filePath, body, 'utf-8');
            json(res, 200, { ok: true });
            return;
          }
        }

        // --- History collection endpoints ---
        const historyMatch = url.match(/^\/__data\/history\/([a-zA-Z0-9_-]+)$/);
        if (historyMatch) {
          const collection = historyMatch[1];
          const filePath = join(HISTORY_DIR, `${collection}.json`);

          if (method === 'GET') {
            const arr = readJsonArray(filePath);
            json(res, 200, arr);
            return;
          }

          if (method === 'PUT') {
            const body = await readBody(req);
            const record = JSON.parse(body) as { id: string };
            const arr = readJsonArray<{ id: string }>(filePath);
            const idx = arr.findIndex((r) => r.id === record.id);
            if (idx >= 0) {
              arr[idx] = record;
            } else {
              arr.push(record);
            }
            writeJson(filePath, arr);
            json(res, 200, { ok: true });
            return;
          }
        }

        // --- Cascade delete session ---
        const deleteMatch = url.match(/^\/__data\/history\/sessions\/([a-zA-Z0-9_-]+)$/);
        if (deleteMatch && method === 'DELETE') {
          const sessionId = deleteMatch[1];

          const sessionsPath = join(HISTORY_DIR, 'sessions.json');
          const shoesPath = join(HISTORY_DIR, 'shoes.json');
          const handsPath = join(HISTORY_DIR, 'hands.json');

          // Remove session
          const sessions = readJsonArray<{ id: string }>(sessionsPath);
          writeJson(sessionsPath, sessions.filter((s) => s.id !== sessionId));

          // Find shoes for this session, collect their IDs, then remove
          const shoes = readJsonArray<{ id: string; sessionId: string }>(shoesPath);
          const shoeIds = new Set(shoes.filter((s) => s.sessionId === sessionId).map((s) => s.id));
          writeJson(shoesPath, shoes.filter((s) => s.sessionId !== sessionId));

          // Remove hands by sessionId or shoeId
          const hands = readJsonArray<{ id: string; sessionId: string; shoeId: string }>(handsPath);
          writeJson(
            handsPath,
            hands.filter((h) => h.sessionId !== sessionId && !shoeIds.has(h.shoeId)),
          );

          json(res, 200, { ok: true });
          return;
        }

        next();
      });
    },
  };
}
