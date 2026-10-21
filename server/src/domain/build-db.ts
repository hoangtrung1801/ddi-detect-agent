import type { Database } from 'better-sqlite3';
import type { InteractionRow } from '../util/csv.ts';
import { normName } from '../util/norm.ts';

export interface BuildStats {
  rows: number;
  drugs: number;
  interactions: number;
  names: string[];
}

/**
 * Create the schema and load interaction rows. `a < b` always; a duplicate pair overwrites the earlier row
 * (matches the Python graph's add_interaction). `src_a` is the id of the drug named first in the sentence.
 * Drug ids are 1-based in first-seen order, so `names[id - 1]` is the drug name.
 */
export function buildDdiDb(db: Database, rows: InteractionRow[]): BuildStats {
  db.exec(`
    DROP TABLE IF EXISTS interactions;
    DROP TABLE IF EXISTS drugs;
    CREATE TABLE drugs(id INTEGER PRIMARY KEY, name TEXT NOT NULL, name_norm TEXT NOT NULL UNIQUE);
    CREATE TABLE interactions(
      a INTEGER NOT NULL, b INTEGER NOT NULL, src_a INTEGER NOT NULL, condition TEXT NOT NULL,
      PRIMARY KEY(a, b)
    ) WITHOUT ROWID;
  `);
  const ids = new Map<string, number>();
  const names: string[] = [];
  const idOf = (name: string): number => {
    const k = normName(name);
    let id = ids.get(k);
    if (id === undefined) {
      id = names.length + 1;
      ids.set(k, id);
      names.push(name.trim());
    }
    return id;
  };
  const edges = new Map<number, { a: number; b: number; src: number; condition: string }>();
  for (const r of rows) {
    const x = idOf(r.drug_1);
    const y = idOf(r.drug_2);
    if (x === y) continue;
    const a = Math.min(x, y);
    const b = Math.max(x, y);
    edges.set(a * 1_000_000 + b, { a, b, src: x, condition: r.condition });
  }
  const insDrug = db.prepare('INSERT INTO drugs(id, name, name_norm) VALUES (?, ?, ?)');
  const insEdge = db.prepare('INSERT INTO interactions(a, b, src_a, condition) VALUES (?, ?, ?, ?)');
  db.transaction(() => {
    names.forEach((n, i) => insDrug.run(i + 1, n, normName(n)));
    for (const e of edges.values()) insEdge.run(e.a, e.b, e.src, e.condition);
  })();
  return { rows: rows.length, drugs: names.length, interactions: edges.size, names };
}
