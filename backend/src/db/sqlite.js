import Database from 'better-sqlite3';
import { DB_PATH } from '../util/paths.js';

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initDb() {
  const d = getDb();
  d.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id          TEXT PRIMARY KEY,
      filename    TEXT NOT NULL,
      upload_date TEXT NOT NULL,
      chunk_count INTEGER NOT NULL DEFAULT 0,
      pages       INTEGER NOT NULL DEFAULT 0,
      status      TEXT NOT NULL DEFAULT 'processing',
      summary     TEXT
    );

    CREATE TABLE IF NOT EXISTS chat_history (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_id     TEXT NOT NULL,
      role       TEXT NOT NULL,           -- 'user' | 'assistant'
      content    TEXT NOT NULL,
      sources    TEXT,                    -- JSON array of cited chunks
      confidence TEXT,                    -- High | Medium | Low
      created_at TEXT NOT NULL,
      FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chat_doc ON chat_history(doc_id);
  `);

  // Migration: add `pages` to databases created before page-aware ingestion.
  const cols = d.prepare('PRAGMA table_info(documents)').all();
  if (!cols.some((c) => c.name === 'pages')) {
    d.exec('ALTER TABLE documents ADD COLUMN pages INTEGER NOT NULL DEFAULT 0');
  }
}
