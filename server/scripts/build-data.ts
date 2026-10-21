// CSV -> data/ddi.sqlite + data/drug-vectors.f32 + data/drug-names.json (replaces GraphML + pickle).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { buildDdiDb } from '../src/domain/build-db.ts';
import { createTransformersEmbedder } from '../src/domain/embedder.ts';
import { parseInteractionCsv } from '../src/util/csv.ts';
import { normName } from '../src/util/norm.ts';

// Expected counts for db_drug_interactions.csv (191,541 rows). 191,135 unique undirected pairs; the legacy
// GraphML reports 191,136 edges / 1,702 nodes because it is stale (extra Alcohol-Acetaminophen edge), see plan log.
const EXPECT = { rows: 191541, drugs: 1701, interactions: 191135 };

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const csvPath = process.env.CSV_PATH ?? here('../../db_drug_interactions.csv');
const outDir = process.env.DATA_DIR ?? here('../data');
const isDefault = !process.env.CSV_PATH;

console.log(`reading ${csvPath}`);
const rows = parseInteractionCsv(readFileSync(csvPath, 'utf8'));
mkdirSync(outDir, { recursive: true });
const dbPath = `${outDir}/ddi.sqlite`;
rmSync(dbPath, { force: true });
const db = new Database(dbPath);
db.pragma('journal_mode = DELETE');
const stats = buildDdiDb(db, rows);
db.close();
console.log(`rows=${stats.rows} drugs=${stats.drugs} interactions=${stats.interactions}`);

const failures: string[] = [];
if (isDefault) {
  for (const k of ['rows', 'drugs', 'interactions'] as const) {
    if (stats[k] !== EXPECT[k]) failures.push(`${k}: got ${stats[k]}, expected ${EXPECT[k]}`);
  }
  const mapping = here('../../drug_embeddings_mapping.json');
  if (existsSync(mapping)) {
    const py = new Set<string>((JSON.parse(readFileSync(mapping, 'utf8')).drug_names as string[]).map(normName));
    const mine = new Set(stats.names.map(normName));
    const missing = [...py].filter((x) => !mine.has(x)).length;
    const extra = [...mine].filter((x) => !py.has(x)).length;
    console.log(`drug-name parity with Python embeddings mapping: missing=${missing} extra=${extra}`);
    if (missing || extra) failures.push('drug names differ from drug_embeddings_mapping.json');
  }
}

console.log('embedding drug names (Xenova/all-MiniLM-L6-v2)...');
const embedder = await createTransformersEmbedder();
const vecs = await embedder.embed(stats.names);
const flat = new Float32Array(vecs.length * embedder.dim);
vecs.forEach((v, i) => flat.set(v, i * embedder.dim));
writeFileSync(`${outDir}/drug-vectors.f32`, Buffer.from(flat.buffer));
writeFileSync(`${outDir}/drug-names.json`, JSON.stringify(stats.names));
console.log(`wrote ${vecs.length} x ${embedder.dim} vectors`);
if (vecs.length !== stats.drugs) failures.push('vector count != drug count');

if (failures.length) {
  console.error('COUNT CHECKS FAILED:\n  ' + failures.join('\n  '));
  process.exit(1);
}
console.log('count checks OK');
