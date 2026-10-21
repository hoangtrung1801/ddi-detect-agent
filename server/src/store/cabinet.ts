import type { Database } from 'better-sqlite3';
import type { DrugDb } from '../domain/drug-db.ts';
import { normName } from '../util/norm.ts';

export interface CabinetPair {
  a: string;
  b: string;
  status: 'interaction' | 'no_record';
  condition: string | null;
  checked_at: string;
}

const ord = (x: string, y: string): [string, string] => (normName(x) <= normName(y) ? [x, y] : [y, x]);

/** Per-user medicine cabinet keyed by resolved DB drug names. Pair checks are pure DB lookups, done at add time. */
export class CabinetStore {
  readonly #db: Database;
  readonly #drugDb: DrugDb;

  constructor(db: Database, drugDb: DrugDb) {
    this.#db = db;
    this.#drugDb = drugDb;
  }

  list(userId: string): string[] {
    return (this.#db.prepare('SELECT db_name FROM cabinet_drugs WHERE user_id = ? ORDER BY db_name').all(userId) as { db_name: string }[]).map(
      (r) => r.db_name,
    );
  }

  has(userId: string, dbName: string): boolean {
    return !!this.#db.prepare('SELECT 1 FROM cabinet_drugs WHERE user_id = ? AND db_name = ?').get(userId, dbName);
  }

  /** Returns the pairs that were checked against the drugs already in the cabinet, or null when already present. */
  add(userId: string, dbName: string, inputName: string): { pairs: CabinetPair[]; existing: string[] } | null {
    if (this.has(userId, dbName)) return null;
    const existing = this.list(userId);
    const now = new Date().toISOString();
    const pairs: CabinetPair[] = [];
    const newDrug = this.#drugDb.getDrug(dbName);
    for (const other of existing) {
      const od = this.#drugDb.getDrug(other);
      const rec = newDrug && od ? this.#drugDb.lookupPair(newDrug, od) : null;
      const [a, b] = ord(dbName, other);
      pairs.push({ a, b, status: rec ? 'interaction' : 'no_record', condition: rec?.condition ?? null, checked_at: now });
    }
    const insDrug = this.#db.prepare('INSERT INTO cabinet_drugs(user_id, db_name, input_name, added_at) VALUES (?, ?, ?, ?)');
    const insPair = this.#db.prepare(
      'INSERT OR REPLACE INTO cabinet_pairs(user_id, a, b, status, condition, checked_at) VALUES (?, ?, ?, ?, ?, ?)',
    );
    this.#db.transaction(() => {
      insDrug.run(userId, dbName, inputName, now);
      for (const p of pairs) insPair.run(userId, p.a, p.b, p.status, p.condition, p.checked_at);
    })();
    return { pairs, existing };
  }

  remove(userId: string, dbName: string): boolean {
    return this.#db.transaction(() => {
      this.#db.prepare('DELETE FROM cabinet_pairs WHERE user_id = ? AND (a = ? OR b = ?)').run(userId, dbName, dbName);
      return this.#db.prepare('DELETE FROM cabinet_drugs WHERE user_id = ? AND db_name = ?').run(userId, dbName).changes > 0;
    })();
  }

  clear(userId: string): void {
    this.#db.transaction(() => {
      this.#db.prepare('DELETE FROM cabinet_pairs WHERE user_id = ?').run(userId);
      this.#db.prepare('DELETE FROM cabinet_drugs WHERE user_id = ?').run(userId);
    })();
  }

  /** All checked pairs that involve `dbName` (both statuses). */
  pairsFor(userId: string, dbName: string): CabinetPair[] {
    return this.#db
      .prepare('SELECT a, b, status, condition, checked_at FROM cabinet_pairs WHERE user_id = ? AND (a = ? OR b = ?) ORDER BY a, b')
      .all(userId, dbName, dbName) as CabinetPair[];
  }
}
