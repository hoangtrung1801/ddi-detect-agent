import type { Database } from 'better-sqlite3';
import { normName } from '../util/norm.ts';

export interface Drug {
  id: number;
  name: string;
  nameNorm: string;
}

export interface PairRecord {
  condition: string;
  /** Name of the drug the interaction sentence names first (the text is directional). */
  firstNamed: string;
}

/** Read access to the interaction database. */
export class DrugDb {
  readonly #db: Database;
  readonly #byNorm = new Map<string, Drug>();
  readonly #byId = new Map<number, Drug>();
  readonly #pairStmt;
  readonly #countStmt;

  constructor(db: Database) {
    this.#db = db;
    for (const r of db.prepare('SELECT id, name, name_norm FROM drugs').all() as {
      id: number;
      name: string;
      name_norm: string;
    }[]) {
      const d: Drug = { id: r.id, name: r.name, nameNorm: r.name_norm };
      this.#byNorm.set(d.nameNorm, d);
      this.#byId.set(d.id, d);
    }
    this.#pairStmt = db.prepare('SELECT src_a, condition FROM interactions WHERE a = ? AND b = ?');
    this.#countStmt = db.prepare('SELECT COUNT(*) AS n FROM interactions');
  }

  /** Accepts any spelling of the name; normalises it. */
  getDrug(name: string): Drug | undefined {
    return this.#byNorm.get(normName(name));
  }

  allNames(): string[] {
    return [...this.#byId.values()].map((d) => d.name);
  }

  lookupPair(a: Drug, b: Drug): PairRecord | null {
    if (a.id === b.id) return null;
    const lo = Math.min(a.id, b.id);
    const hi = Math.max(a.id, b.id);
    const row = this.#pairStmt.get(lo, hi) as { src_a: number; condition: string } | undefined;
    if (!row) return null;
    return { condition: row.condition, firstNamed: this.#byId.get(row.src_a)?.name ?? a.name };
  }

  stats(): { drugs: number; interactions: number } {
    return { drugs: this.#byNorm.size, interactions: (this.#countStmt.get() as { n: number }).n };
  }

  close(): void {
    this.#db.close();
  }
}
