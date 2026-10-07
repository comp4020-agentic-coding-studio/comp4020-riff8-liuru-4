import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";

export const KINDS = ["dream", "illusion", "bubble", "shadow", "dew", "lightning"] as const;
export type Kind = (typeof KINDS)[number];

export interface Trace {
  id: number;
  visitorId: string;
  kind: Kind;
  text: string;
  createdAt: number;
}

export function isKind(value: string): value is Kind {
  return (KINDS as readonly string[]).includes(value);
}

const dataDir = process.env.DATA_DIR ?? "./data";
mkdirSync(dataDir, { recursive: true });

const dbPath = `${dataDir}/app.db`;
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS traces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

// Additive migration: existing traces keep a NULL submission key. The key lets
// a visitor resend an uncertain POST without creating a second trace.
const columns = db.prepare("PRAGMA table_info(traces)").all() as { name: string }[];
if (!columns.some((c) => c.name === "submission_key")) {
  db.exec("ALTER TABLE traces ADD COLUMN submission_key TEXT");
}
db.exec(
  "CREATE UNIQUE INDEX IF NOT EXISTS traces_submission ON traces (visitor_id, submission_key) WHERE submission_key IS NOT NULL",
);

const fields = "id, visitor_id AS visitorId, kind, text, created_at AS createdAt";

const insertTrace = db.prepare(
  "INSERT INTO traces (visitor_id, kind, text, created_at, submission_key) VALUES (?, ?, ?, ?, ?)",
);
const selectBySubmission = db.prepare(
  `SELECT ${fields} FROM traces WHERE visitor_id = ? AND submission_key = ?`,
);
const selectById = db.prepare(`SELECT ${fields} FROM traces WHERE id = ?`);
const selectAll = db.prepare(`SELECT ${fields} FROM traces ORDER BY id DESC`);
const selectAfter = db.prepare(`SELECT ${fields} FROM traces WHERE id > ? ORDER BY id ASC`);

/**
 * Stores a trace and returns it, plus whether it was new. A repeated
 * submission key from the same visitor returns the original trace instead.
 */
export function addTrace(
  visitorId: string,
  kind: Kind,
  text: string,
  submissionKey: string | null = null,
): { trace: Trace; created: boolean } {
  if (submissionKey) {
    const existing = selectBySubmission.get(visitorId, submissionKey) as Trace | undefined;
    if (existing) return { trace: existing, created: false };
  }
  const info = insertTrace.run(visitorId, kind, text, Date.now(), submissionKey);
  return { trace: traceById(Number(info.lastInsertRowid))!, created: true };
}

export function traceById(id: number): Trace | undefined {
  return selectById.get(id) as Trace | undefined;
}

/** The whole wall, newest first. No pagination: search covers all of it. */
export function allTraces(): Trace[] {
  return selectAll.all() as Trace[];
}

/** Traces stored after `id`, oldest first: the replay a reconnecting tab needs. */
export function tracesAfter(id: number): Trace[] {
  return selectAfter.all(id) as Trace[];
}
