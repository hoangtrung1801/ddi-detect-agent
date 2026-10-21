import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { buildDdiDb } from '../../src/domain/build-db.ts';
import { DrugDb } from '../../src/domain/drug-db.ts';
import { Resolver } from '../../src/domain/resolver.ts';
import { parseInteractionCsv } from '../../src/util/csv.ts';
import { stubEmbedder, stubVectorIndex } from './stub-embedder.ts';

export async function makeDomain(opts: { resolveMin?: number } = {}) {
  const rows = parseInteractionCsv(readFileSync(new URL('../fixtures/mini.csv', import.meta.url), 'utf8'));
  const db = new Database(':memory:');
  const stats = buildDdiDb(db, rows);
  const drugDb = new DrugDb(db);
  const embedder = stubEmbedder();
  const vectors = await stubVectorIndex(stats.names, embedder);
  const resolver = new Resolver({ drugDb, vectors, embedder, resolveMin: opts.resolveMin ?? 0.8 });
  return { db, drugDb, resolver, stats, embedder, vectors };
}
