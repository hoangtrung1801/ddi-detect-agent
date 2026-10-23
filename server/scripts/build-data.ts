// Build the DDInter database and matching embeddings before replacing active artifacts.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { buildDdiDb } from '../src/domain/build-db.ts';
import { createTransformersEmbedder } from '../src/domain/embedder.ts';
import { parseInteractionCsv } from '../src/util/csv.ts';
import { applyInteractionDetail } from '../src/domain/ddinter-details.ts';

const csvPath = fileURLToPath(new URL('../../db_drug_interactions.csv', import.meta.url));
const outDir = process.env.DATA_DIR ?? fileURLToPath(new URL('../data', import.meta.url));
const manifestPath = `${outDir}/ddinter/manifest.json`;
const archivePath = `${outDir}/ddinter/crawl.sqlite`;
if (existsSync(`${archivePath}.lock`)) throw new Error('Stop the DDInter crawler before rebuilding the database; resume it afterward.');
if (!existsSync(manifestPath)) throw new Error('Missing DDInter source manifest. Run pnpm data:download first.');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const csv = readFileSync(csvPath, 'utf8');
if (createHash('sha256').update(csv).digest('hex') !== manifest.processed.sha256) throw new Error('Processed CSV checksum differs from DDInter manifest');
const rows = parseInteractionCsv(csv);
if (rows.length !== manifest.records || rows.some((r) => !r.drug_1_id || !r.drug_2_id || !r.level || !r.source_rows)) {
  throw new Error('Expected processed DDInter records with IDs, levels and provenance');
}
mkdirSync(outDir, { recursive: true });
const staging = mkdtempSync(`${outDir}/.ddinter-build-`);
let db: Database.Database | undefined;
try {
  db = new Database(`${staging}/ddi.sqlite`);
  db.pragma('foreign_keys = ON');
  const stats = buildDdiDb(db, rows);
  if (stats.drugs !== manifest.drugs) throw new Error('Drug count differs from source manifest');
  db.prepare('INSERT INTO dataset_metadata(key,value) VALUES (?,?)').run('manifest', JSON.stringify(manifest));
  if (existsSync(archivePath)) {
    const archive = new Database(archivePath, { readonly: true });
    let applied = 0;
    try {
      db.transaction(() => {
        for (const row of archive.prepare("SELECT detail_json FROM pages WHERE state='done' ORDER BY id").iterate() as Iterable<{ detail_json: string }>) {
          if (applyInteractionDetail(db!, JSON.parse(row.detail_json))) applied++;
        }
      })();
      db.prepare('INSERT INTO dataset_metadata(key,value) VALUES (?,?)').run('enrichment', JSON.stringify({ archive: 'ddinter/crawl.sqlite', applied }));
      console.log(`Restored ${applied} crawled source pages from the enrichment archive.`);
    } finally { archive.close(); }
  }
  if (db.pragma('integrity_check', { simple: true }) !== 'ok' || (db.pragma('foreign_key_check') as unknown[]).length) throw new Error('Database integrity failed');
  db.close(); db = undefined;
  console.log(`DDInter rows=${stats.rows} drugs=${stats.drugs} pairs=${stats.interactions}`);
  const embedder = await createTransformersEmbedder();
  const flat = new Float32Array(stats.names.length * embedder.dim);
  // Bound embedding memory on large catalogs.
  for (let start = 0; start < stats.names.length; start += 64) {
    const vectors = await embedder.embed(stats.names.slice(start, start + 64));
    if (vectors.length !== Math.min(64, stats.names.length - start)) throw new Error('Embedding count mismatch');
    vectors.forEach((v, i) => {
      if (v.length !== embedder.dim || !v.every(Number.isFinite)) throw new Error('Invalid embedding');
      flat.set(v, (start + i) * embedder.dim);
    });
  }
  writeFileSync(`${staging}/drug-vectors.f32`, Buffer.from(flat.buffer));
  writeFileSync(`${staging}/drug-names.json`, JSON.stringify(stats.names));
  // Offline rebuild: stop the server first so no process retains an old database/catalog.
  for (const file of ['drug-vectors.f32', 'drug-names.json', 'ddi.sqlite']) renameSync(`${staging}/${file}`, `${outDir}/${file}`);
  console.log(`Replaced DDInter database and ${stats.drugs} x ${embedder.dim} vectors.`);
} finally {
  db?.close();
  rmSync(staging, { recursive: true, force: true });
}
