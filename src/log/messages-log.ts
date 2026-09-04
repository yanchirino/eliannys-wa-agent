import { getDB } from "../memory/d1.js";
import type { D1Database } from "../memory/d1-saver.js";

export type Direction = "in" | "out";

let setupDone: Promise<void> | null = null;
function ensureTable(db: D1Database): Promise<void> {
  return (setupDone ??= (async () => {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS messages_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          thread_id TEXT NOT NULL, direction TEXT NOT NULL,
          text TEXT, type TEXT, created_at INTEGER NOT NULL)`,
      )
      .run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_messages_log_thread ON messages_log (thread_id, created_at)`).run();
  })());
}

export async function logMessage(threadId: string, direction: Direction, text: string, type: string): Promise<void> {
  const db = await getDB();
  if (!db) return;
  try {
    await ensureTable(db);
    await db
      .prepare(`INSERT INTO messages_log (thread_id, direction, text, type, created_at) VALUES (?,?,?,?,?)`)
      .bind(threadId, direction, text, type, Date.now())
      .run();
  } catch {
    // best-effort: nunca romper la conversación
  }
}

export async function listConversations(limit = 50): Promise<unknown[]> {
  const db = await getDB();
  if (!db) return [];
  await ensureTable(db);
  const res = await db
    .prepare(
      `SELECT m.thread_id, m.text, m.direction, m.created_at
       FROM messages_log m
       JOIN (SELECT thread_id, MAX(created_at) AS mx FROM messages_log GROUP BY thread_id) t
         ON m.thread_id = t.thread_id AND m.created_at = t.mx
       ORDER BY m.created_at DESC LIMIT ?`,
    )
    .bind(limit)
    .all();
  return res.results;
}

export async function getConversation(threadId: string, limit = 200): Promise<unknown[]> {
  const db = await getDB();
  if (!db) return [];
  await ensureTable(db);
  const res = await db
    .prepare(`SELECT direction, text, type, created_at FROM messages_log WHERE thread_id = ? ORDER BY created_at ASC, id ASC LIMIT ?`)
    .bind(threadId, limit)
    .all();
  return res.results;
}
