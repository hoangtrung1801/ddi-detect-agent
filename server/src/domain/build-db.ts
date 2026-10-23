import type { Database } from 'better-sqlite3';
import type { InteractionRow } from '../util/csv.ts';
import { normName } from '../util/norm.ts';
import { DDINTER, type SourceInteractionRecord } from './ddinter.ts';
import type { Severity } from './risk.ts';
import { createInteractionDetailsTable } from './ddinter-details.ts';

export interface BuildStats {
  rows: number;
  drugs: number;
  interactions: number;
  names: string[];
}

/** Pair lookup is unordered; distinct descriptions and source evidence are never overwritten. */
export function buildDdiDb(db: Database, rows: InteractionRow[]): BuildStats {
  db.exec(`
    DROP TABLE IF EXISTS interaction_details;
    DROP TABLE IF EXISTS interaction_records;
    DROP TABLE IF EXISTS interactions;
    DROP TABLE IF EXISTS drugs;
    DROP TABLE IF EXISTS dataset_metadata;
    CREATE TABLE drugs(id INTEGER PRIMARY KEY, name TEXT NOT NULL, name_norm TEXT NOT NULL UNIQUE, source_id TEXT UNIQUE);
    CREATE TABLE interactions(
      a INTEGER NOT NULL REFERENCES drugs(id), b INTEGER NOT NULL REFERENCES drugs(id),
      src_a INTEGER NOT NULL REFERENCES drugs(id), condition TEXT NOT NULL,
      source_records TEXT NOT NULL, source_severity TEXT,
      CHECK(a < b), CHECK(src_a = a OR src_a = b), PRIMARY KEY(a, b)
    ) WITHOUT ROWID;
    CREATE TABLE interaction_records(
      a INTEGER NOT NULL, b INTEGER NOT NULL, src_a INTEGER NOT NULL,
      condition TEXT NOT NULL, level TEXT, drug_a_id TEXT, drug_b_id TEXT, source_rows TEXT,
      FOREIGN KEY(a,b) REFERENCES interactions(a,b)
    );
    CREATE TABLE dataset_metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
  `);
  createInteractionDetailsTable(db);
  const ids = new Map<string, number>();
  const sourceIds = new Map<number, string>();
  const names: string[] = [];
  const idOf = (name: string, sourceId?: string): number => {
    const k = normName(name);
    let id = ids.get(k);
    if (id === undefined) {
      id = names.length + 1;
      ids.set(k, id);
      names.push(name.trim());
    }
    if (sourceId) {
      if (sourceIds.has(id) && sourceIds.get(id) !== sourceId) throw new Error(`Conflicting source IDs for ${name}`);
      sourceIds.set(id, sourceId);
    }
    return id;
  };
  type Edge = { a: number; b: number; src: number; rows: InteractionRow[]; keys: Set<string> };
  const edges = new Map<string, Edge>();
  for (const r of rows) {
    const x = idOf(r.drug_1, r.drug_1_id);
    const y = idOf(r.drug_2, r.drug_2_id);
    if (x === y) throw new Error(`Self interaction: ${r.drug_1}`);
    const a = Math.min(x, y), b = Math.max(x, y);
    const key = `${a}:${b}`;
    let edge = edges.get(key);
    if (!edge) { edge = { a, b, src: x, rows: [], keys: new Set() }; edges.set(key, edge); }
    const recordKey = JSON.stringify([x, r.condition, r.drug_1_id, r.drug_2_id, r.level]);
    if (!edge.keys.has(recordKey)) { edge.keys.add(recordKey); edge.rows.push(r); }
  }
  const insDrug = db.prepare('INSERT INTO drugs(id,name,name_norm,source_id) VALUES (?,?,?,?)');
  const insEdge = db.prepare('INSERT INTO interactions(a,b,src_a,condition,source_records,source_severity) VALUES (?,?,?,?,?,?)');
  const insRecord = db.prepare('INSERT INTO interaction_records(a,b,src_a,condition,level,drug_a_id,drug_b_id,source_rows) VALUES (?,?,?,?,?,?,?,?)');
  const rank = { minor: 1, moderate: 2, major: 3 };
  db.transaction(() => {
    names.forEach((n, i) => insDrug.run(i + 1, n, normName(n), sourceIds.get(i + 1) ?? null));
    for (const e of edges.values()) {
      const sourceRecords: SourceInteractionRecord[] = e.rows.filter((r) => r.drug_1_id && r.drug_2_id && r.level).map((r) => ({
        source: DDINTER.source, drugAId: r.drug_1_id!, drugBId: r.drug_2_id!, level: r.level!, url: DDINTER.downloads,
      }));
      let severity: Severity | null = null;
      for (const r of sourceRecords) {
        const s = r.level.toLowerCase();
        if (s === 'major' || s === 'moderate' || s === 'minor') {
          if (!severity || rank[s] > rank[severity]) severity = s;
        }
      }
      if (sourceRecords.some((r) => r.level === 'Unknown') && severity !== 'major') severity = null;
      insEdge.run(e.a, e.b, e.src, [...new Set(e.rows.map((r) => r.condition))].join('\n'), JSON.stringify(sourceRecords), severity);
      for (const r of e.rows) insRecord.run(e.a, e.b, ids.get(normName(r.drug_1))!, r.condition, r.level ?? null, r.drug_1_id ?? null, r.drug_2_id ?? null, r.source_rows ?? null);
    }
  })();
  return { rows: rows.length, drugs: names.length, interactions: edges.size, names };
}
