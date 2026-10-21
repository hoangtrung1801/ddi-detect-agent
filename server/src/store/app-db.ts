import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import type { Database as Db } from 'better-sqlite3';

const MIGRATIONS: string[] = [
  `
  CREATE TABLE sessions(
    id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_report_json TEXT
  );
  CREATE TABLE session_messages(
    session_id TEXT NOT NULL, seq INTEGER NOT NULL, message_json TEXT NOT NULL,
    PRIMARY KEY(session_id, seq)
  );
  CREATE TABLE cabinet_drugs(
    user_id TEXT NOT NULL, db_name TEXT NOT NULL, input_name TEXT NOT NULL, added_at TEXT NOT NULL,
    PRIMARY KEY(user_id, db_name)
  );
  CREATE TABLE cabinet_pairs(
    user_id TEXT NOT NULL, a TEXT NOT NULL, b TEXT NOT NULL, status TEXT NOT NULL, condition TEXT,
    checked_at TEXT NOT NULL,
    PRIMARY KEY(user_id, a, b)
  );
  CREATE TABLE cache(
    kind TEXT NOT NULL, key TEXT NOT NULL, value_json TEXT NOT NULL, expires_at INTEGER NOT NULL,
    PRIMARY KEY(kind, key)
  );
  `,
];

/** Open (and migrate) the application database. `:memory:` is allowed for tests. */
export function openAppDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  if (path !== ':memory:') db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

export function migrate(db: Db): void {
  const current = db.pragma('user_version', { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]!);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}
