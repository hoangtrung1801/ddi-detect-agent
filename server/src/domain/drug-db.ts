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
  /** Neighbour ids per drug id, built on first graph query. */
  #adj: Map<number, number[]> | null = null;

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

  /** Number of drugs each drug interacts with. */
  degree(d: Drug): number {
    return this.#adjacency().get(d.id)?.length ?? 0;
  }

  /** Drugs that interact with `d`, most-connected first. */
  neighbors(d: Drug, limit: number): Drug[] {
    const ids = this.#adjacency().get(d.id) ?? [];
    return this.#byDegree(ids).slice(0, limit);
  }

  /** The most-connected drugs in the database. */
  hubs(limit: number): Drug[] {
    return this.#byDegree([...this.#adjacency().keys()]).slice(0, limit);
  }

  /** Case-insensitive substring search over drug names; prefix matches first. */
  search(q: string, limit: number): Drug[] {
    const k = normName(q);
    if (!k) return [];
    const hits = [...this.#byId.values()].filter((d) => d.nameNorm.includes(k));
    hits.sort((x, y) => Number(!x.nameNorm.startsWith(k)) - Number(!y.nameNorm.startsWith(k)) || x.name.length - y.name.length);
    return hits.slice(0, limit);
  }

  #byDegree(ids: number[]): Drug[] {
    const adj = this.#adjacency();
    return ids
      .map((id) => this.#byId.get(id)!)
      .sort((x, y) => (adj.get(y.id)?.length ?? 0) - (adj.get(x.id)?.length ?? 0) || x.name.localeCompare(y.name));
  }

  #adjacency(): Map<number, number[]> {
    if (this.#adj) return this.#adj;
    const adj = new Map<number, number[]>();
    const push = (k: number, v: number) => {
      const l = adj.get(k);
      if (l) l.push(v);
      else adj.set(k, [v]);
    };
    for (const r of this.#db.prepare('SELECT a, b FROM interactions').iterate() as Iterable<{ a: number; b: number }>) {
      push(r.a, r.b);
      push(r.b, r.a);
    }
    this.#adj = adj;
    return adj;
  }

  stats(): { drugs: number; interactions: number } {
    return { drugs: this.#byNorm.size, interactions: (this.#countStmt.get() as { n: number }).n };
  }

  close(): void {
    this.#db.close();
  }
}
