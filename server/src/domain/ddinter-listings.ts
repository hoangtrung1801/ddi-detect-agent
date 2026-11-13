import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { normName } from '../util/norm.ts';
import { createDdinterClient, DDINTER_BASE_URL } from './ddinter-client.ts';
import { DDINTER, type SourceInteractionRecord } from './ddinter.ts';
import { sourceSeverity } from './build-db.ts';

/**
 * DDInter's category CSV exports omit every pair in which neither drug belongs to an exported
 * ATC group (e.g. Sildenafil G04 + Nitroglycerin C01). Each drug's public interaction listing
 * (the DataTables endpoint behind its drug page) names all of that drug's partners, the
 * interaction page id and the risk level. This module crawls those listings and adds only the
 * pairs the site records, with the site's level and the page they came from.
 */

/**
 * The listing encodes the risk level as an integer. The mapping was checked against the CSV
 * export for every pair present in both (see the supplement report's levelAgreement) and
 * against the level badge on the interaction pages; any other value is rejected.
 */
export const LISTING_LEVELS = { 0: 'Unknown', 1: 'Minor', 2: 'Moderate', 3: 'Major' } as const;
export type ListingLevel = (typeof LISTING_LEVELS)[keyof typeof LISTING_LEVELS];

export interface ListingEntry {
  /** The drug whose listing was read. */
  drugId: string;
  partnerId: string;
  partnerName: string;
  interactionId: number;
  level: ListingLevel;
  retrievedAt: string;
}

export interface ListingPage {
  total: number;
  entries: ListingEntry[];
  /** Interaction page ids where the site lists the drug with itself (e.g. two formulations); not a drug pair. */
  selfPages: number[];
}

export const interactionPageUrl = (id: number) => `${DDINTER_BASE_URL}/server/interact/${id}/`;
export const drugPageUrl = (id: string) => `${DDINTER_BASE_URL}/server/drug-detail/${id}/`;

/** Validate one DataTables response; anything unexpected (login/challenge page, schema change) throws. */
export function parseListingPage(body: string, drugId: string, offset: number, retrievedAt: string): ListingPage {
  let listing: { recordsTotal?: unknown; recordsFiltered?: unknown; data?: unknown };
  try { listing = JSON.parse(body); } catch { throw new Error(`Listing for ${drugId}: response is not JSON`); }
  const total = listing.recordsTotal;
  if (!Number.isSafeInteger(total) || (total as number) < 0 || total !== listing.recordsFiltered || !Array.isArray(listing.data)) {
    throw new Error(`Listing for ${drugId}: invalid/unexpected response`);
  }
  if (!listing.data.length && offset < (total as number)) throw new Error(`Listing for ${drugId}: empty page before the end`);
  const selfPages: number[] = [];
  const entries = (listing.data as Record<string, unknown>[]).flatMap((raw) => {
    const { drug_id: partnerId, drug_name: name, interaction_id: interactionId, level } = raw;
    if (typeof partnerId !== 'string' || !/^DDInter\d+$/.test(partnerId)) throw new Error(`Listing for ${drugId}: malformed partner id`);
    if (typeof name !== 'string' || !name.trim()) throw new Error(`Listing for ${drugId}: missing partner name`);
    if (!Number.isSafeInteger(interactionId) || (interactionId as number) < 1) throw new Error(`Listing for ${drugId}: malformed interaction id`);
    if (!Number.isInteger(level) || !Object.hasOwn(LISTING_LEVELS, level as number)) throw new Error(`Listing for ${drugId}: unexpected level ${String(level)}`);
    if (partnerId === drugId) { selfPages.push(interactionId as number); return []; }
    return [{
      drugId, partnerId, partnerName: name.replace(/\s+/g, ' ').trim(), interactionId: interactionId as number,
      level: LISTING_LEVELS[level as keyof typeof LISTING_LEVELS], retrievedAt,
    }];
  });
  return { total: total as number, entries, selfPages };
}

export interface ListingCrawlOptions {
  database: string;
  archive: string;
  intervalMs?: number;
  concurrency?: number;
  /** Rows requested per listing page. The site honours large pages, so most drugs need one request. */
  pageSize?: number;
  /** Stop after this many listing requests (a bounded first run). */
  maxRequests?: number;
  signal?: AbortSignal;
  onProgress?: (status: ListingCrawlStatus) => void;
  baseUrl?: string;
}

export interface ListingCrawlStatus {
  state: string;
  seedDrugs: number;
  queuedDrugs: number;
  completedDrugs: number;
  entries: number;
  pairs: number;
  /** Listing rows naming a drug with itself (skipped: not a pair). */
  selfPages: number;
  error: string | null;
}

export function createListingArchive(archive: Database.Database): void {
  archive.exec(`CREATE TABLE IF NOT EXISTS queue(drug_id TEXT PRIMARY KEY, seed INTEGER NOT NULL, offset INTEGER NOT NULL DEFAULT 0, total INTEGER, complete INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS listings(drug_id TEXT, offset INTEGER, total INTEGER, returned INTEGER, sha256 TEXT, retrieved_at TEXT, PRIMARY KEY(drug_id, offset));
    CREATE TABLE IF NOT EXISTS entries(drug_id TEXT NOT NULL, partner_id TEXT NOT NULL, partner_name TEXT NOT NULL, interaction_id INTEGER NOT NULL, level TEXT NOT NULL, retrieved_at TEXT NOT NULL, PRIMARY KEY(drug_id, interaction_id, partner_id));
    CREATE TABLE IF NOT EXISTS self_pages(drug_id TEXT NOT NULL, interaction_id INTEGER NOT NULL, PRIMARY KEY(drug_id, interaction_id));
    CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
}

export function listingCrawlStatus(archive: Database.Database): ListingCrawlStatus {
  const counts = archive.prepare(`SELECT
    (SELECT COUNT(*) FROM queue WHERE seed=1) seedDrugs,
    (SELECT COUNT(*) FROM queue) queuedDrugs,
    (SELECT COUNT(*) FROM queue WHERE complete=1) completedDrugs,
    (SELECT COUNT(*) FROM entries) entries,
    (SELECT COUNT(*) FROM (SELECT DISTINCT min(drug_id,partner_id), max(drug_id,partner_id) FROM entries)) pairs,
    (SELECT COUNT(*) FROM self_pages) selfPages`).get() as Omit<ListingCrawlStatus, 'state' | 'error'>;
  const meta = Object.fromEntries((archive.prepare('SELECT key,value FROM metadata').all() as { key: string; value: string }[]).map((r) => [r.key, r.value]));
  return { ...counts, state: meta.state ?? 'not_started', error: meta.error || null };
}

/**
 * Breadth-first crawl of drug interaction listings, seeded with every drug in the current
 * database and extended to any partner the site names, so pairs between two drugs that are
 * absent from the CSV exports are found too. Resumable: completed listings are never refetched.
 */
export async function crawlInteractionListings(options: ListingCrawlOptions): Promise<ListingCrawlStatus> {
  const main = new Database(options.database, { fileMustExist: true, readonly: true });
  const archive = new Database(options.archive);
  archive.pragma('journal_mode = WAL');
  archive.pragma('busy_timeout = 10000');
  createListingArchive(archive);
  const meta = archive.prepare('INSERT INTO metadata(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  const pageSize = options.pageSize ?? 2000;
  const concurrency = options.concurrency ?? 2;
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) throw new Error('concurrency must be a positive integer');
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) throw new Error('pageSize must be a positive integer');
  const client = createDdinterClient({ baseUrl: options.baseUrl, intervalMs: options.intervalMs ?? 500, signal: options.signal, onRateLimited: (until) => meta.run('retry_after', String(until)) });
  let requests = 0;
  const publish = () => { meta.run('updated_at', new Date().toISOString()); options.onProgress?.(listingCrawlStatus(archive)); };
  const enqueue = archive.prepare('INSERT INTO queue(drug_id, seed) VALUES (?, ?) ON CONFLICT(drug_id) DO NOTHING');
  const insertEntry = archive.prepare('INSERT OR REPLACE INTO entries VALUES (?,?,?,?,?,?)');
  const fetchListing = async (job: { drug_id: string; offset: number; total: number | null }) => {
    const response = await client.request(`/server/interact-with/${job.drug_id}/`, new URLSearchParams({ start: String(job.offset), length: String(pageSize), draw: '1', severity: '', mechanism: '' }));
    if (!response.ok) throw new Error(`Listing HTTP ${response.status} for ${job.drug_id}`);
    const body = await response.text();
    const retrievedAt = new Date().toISOString();
    const page = parseListingPage(body, job.drug_id, job.offset, retrievedAt);
    archive.transaction(() => {
      if (job.offset > 0 && page.total !== job.total) {
        // The listing changed between pages; offsets are no longer comparable, so start the drug over.
        archive.prepare('DELETE FROM entries WHERE drug_id=?').run(job.drug_id);
        archive.prepare('DELETE FROM listings WHERE drug_id=?').run(job.drug_id);
        archive.prepare('UPDATE queue SET offset=0,total=NULL,complete=0 WHERE drug_id=?').run(job.drug_id);
        return;
      }
      for (const e of page.entries) {
        insertEntry.run(e.drugId, e.partnerId, e.partnerName, e.interactionId, e.level, e.retrievedAt);
        enqueue.run(e.partnerId, 0);
      }
      for (const id of page.selfPages) archive.prepare('INSERT OR IGNORE INTO self_pages VALUES (?,?)').run(job.drug_id, id);
      const returned = page.entries.length + page.selfPages.length;
      const next = job.offset + returned;
      archive.prepare('UPDATE queue SET offset=?,total=?,complete=? WHERE drug_id=?').run(next, page.total, Number(next >= page.total), job.drug_id);
      archive.prepare('INSERT OR REPLACE INTO listings VALUES (?,?,?,?,?,?)').run(job.drug_id, job.offset, page.total, returned, createHash('sha256').update(body).digest('hex'), retrievedAt);
    })();
    if (++requests % 25 === 0) publish();
  };
  try {
    const retry = archive.prepare('SELECT value FROM metadata WHERE key=?').get('retry_after') as { value: string } | undefined;
    if (retry && Number(retry.value) > Date.now()) throw new Error(`Rate-limit deadline has not elapsed: ${new Date(Number(retry.value)).toISOString()}`);
    meta.run('state', 'running'); meta.run('error', '');
    archive.transaction(() => {
      for (const { source_id } of main.prepare('SELECT source_id FROM drugs WHERE source_id IS NOT NULL ORDER BY id').iterate() as Iterable<{ source_id: string }>) enqueue.run(source_id, 1);
      archive.prepare('INSERT OR IGNORE INTO metadata(key,value) VALUES (?,?)').run('created_at', new Date().toISOString());
    })();
    await client.checkRobots();
    await client.bootstrapListingToken();
    const inflight = new Set<string>();
    const running = new Set<Promise<void>>();
    let failure: unknown;
    const limitReached = () => options.maxRequests !== undefined && requests + inflight.size >= options.maxRequests;
    for (;;) {
      options.signal?.throwIfAborted();
      while (failure === undefined && running.size < concurrency && !limitReached()) {
        const jobs = archive.prepare('SELECT drug_id,offset,total FROM queue WHERE complete=0 ORDER BY seed DESC, rowid LIMIT ?').all(inflight.size + 1) as { drug_id: string; offset: number; total: number | null }[];
        const job = jobs.find((j) => !inflight.has(j.drug_id));
        if (!job) break;
        inflight.add(job.drug_id);
        const done: Promise<void> = fetchListing(job).catch((error) => { failure ??= error; }).finally(() => { inflight.delete(job.drug_id); running.delete(done); });
        running.add(done);
      }
      if (!running.size) break;
      await Promise.race(running);
      if (failure !== undefined) {
        await Promise.allSettled(running);
        throw client.halted ?? failure;
      }
    }
    const status = listingCrawlStatus(archive);
    meta.run('state', status.completedDrugs === status.queuedDrugs ? 'completed' : 'paused');
    publish();
    return listingCrawlStatus(archive);
  } catch (error) {
    meta.run('state', options.signal?.aborted ? 'paused' : 'error');
    meta.run('error', String(error)); publish();
    if (!options.signal?.aborted) throw error;
    return listingCrawlStatus(archive);
  } finally { main.close(); archive.close(); }
}

export function readListingEntries(archive: Database.Database): { entries: ListingEntry[]; complete: boolean } {
  const entries = (archive.prepare('SELECT drug_id,partner_id,partner_name,interaction_id,level,retrieved_at FROM entries ORDER BY drug_id,interaction_id,partner_id').all() as {
    drug_id: string; partner_id: string; partner_name: string; interaction_id: number; level: ListingLevel; retrieved_at: string;
  }[]).map((r) => ({ drugId: r.drug_id, partnerId: r.partner_id, partnerName: r.partner_name, interactionId: r.interaction_id, level: r.level, retrievedAt: r.retrieved_at }));
  const { open } = archive.prepare('SELECT COUNT(*) open FROM queue WHERE complete=0').get() as { open: number };
  return { entries, complete: open === 0 };
}

export interface SupplementStats {
  /** Distinct unordered drug pairs named by the crawled listings. */
  listedPairs: number;
  /** Listed pairs already present from the CSV exports (left untouched). */
  pairsAlreadyInCsv: number;
  /** For those pairs: listing level equals a CSV level for the pair / differs from every CSV level. */
  levelAgreement: number;
  levelDisagreement: number;
  addedPairs: number;
  /** Added pairs by listed level ("Major", or "Moderate/Major" if pages disagree). */
  addedByLevel: Record<string, number>;
  addedDrugs: number;
  addedDrugNames: string[];
  /** Pairs skipped because a partner's name collides with a different catalog drug. */
  skippedNameConflicts: number;
}

/**
 * Insert pairs that DDInter lists on its website but that are absent from the CSV exports.
 * Never touches existing pairs or their CSV severity; never invents a level (only the listing's own).
 * New drugs get the name the site lists and ids after the current maximum, so name/vector files
 * can be extended by appending.
 */
export function applyListingSupplement(db: Database.Database, entries: ListingEntry[]): SupplementStats {
  const drugs = db.prepare('SELECT id,name_norm,source_id FROM drugs').all() as { id: number; name_norm: string; source_id: string | null }[];
  const bySource = new Map(drugs.filter((d) => d.source_id).map((d) => [d.source_id!, d.id]));
  const byNorm = new Map(drugs.map((d) => [d.name_norm, d]));
  let nextId = Math.max(0, ...drugs.map((d) => d.id)) + 1;
  const names = new Map<string, string>();
  for (const e of entries) {
    const known = names.get(e.partnerId);
    if (known !== undefined && known !== e.partnerName) throw new Error(`Listings name ${e.partnerId} both "${known}" and "${e.partnerName}"`);
    names.set(e.partnerId, e.partnerName);
  }
  type Pair = { ids: [string, string]; records: Map<string, ListingEntry> };
  const pairs = new Map<string, Pair>();
  for (const e of entries) {
    const ids = [e.drugId, e.partnerId].sort((x, y) => Number(x.slice(7)) - Number(y.slice(7))) as [string, string];
    const key = ids.join('|');
    let pair = pairs.get(key);
    if (!pair) pairs.set(key, pair = { ids, records: new Map() });
    // Both endpoints list the same page; keep one record per (page, level), the earliest retrieval.
    const recordKey = `${e.interactionId}|${e.level}`;
    const prior = pair.records.get(recordKey);
    if (!prior || e.retrievedAt < prior.retrievedAt) pair.records.set(recordKey, e);
  }
  const stats: SupplementStats = {
    listedPairs: pairs.size, pairsAlreadyInCsv: 0, levelAgreement: 0, levelDisagreement: 0,
    addedPairs: 0, addedByLevel: {}, addedDrugs: 0, addedDrugNames: [], skippedNameConflicts: 0,
  };
  const existing = db.prepare('SELECT source_records FROM interactions WHERE a=? AND b=?');
  const insDrug = db.prepare('INSERT INTO drugs(id,name,name_norm,source_id) VALUES (?,?,?,?)');
  const insEdge = db.prepare('INSERT INTO interactions(a,b,src_a,condition,source_records,source_severity) VALUES (?,?,?,?,?,?)');
  const insRecord = db.prepare('INSERT INTO interaction_records(a,b,src_a,condition,level,drug_a_id,drug_b_id,source_rows) VALUES (?,?,?,?,?,?,?,?)');
  const resolveDrug = (sourceId: string): number | null => {
    const id = bySource.get(sourceId);
    if (id !== undefined) return id;
    const name = names.get(sourceId);
    if (!name) return null;
    const norm = normName(name);
    if (!norm || byNorm.has(norm)) return null; // same normalized name, different DDInter id: do not merge or guess
    const newId = nextId++;
    insDrug.run(newId, name, norm, sourceId);
    bySource.set(sourceId, newId); byNorm.set(norm, { id: newId, name_norm: norm, source_id: sourceId });
    stats.addedDrugs++; stats.addedDrugNames.push(name);
    return newId;
  };
  db.transaction(() => {
    for (const pair of [...pairs.values()].sort((x, y) => x.ids.join('|').localeCompare(y.ids.join('|')))) {
      const [idA, idB] = pair.ids;
      const records = [...pair.records.values()].sort((x, y) => x.interactionId - y.interactionId || x.level.localeCompare(y.level));
      const knownA = bySource.get(idA), knownB = bySource.get(idB);
      if (knownA !== undefined && knownB !== undefined) {
        const row = existing.get(Math.min(knownA, knownB), Math.max(knownA, knownB)) as { source_records: string } | undefined;
        if (row) {
          stats.pairsAlreadyInCsv++;
          const csvLevels = new Set((JSON.parse(row.source_records) as SourceInteractionRecord[]).map((r) => r.level));
          if (records.every((r) => csvLevels.has(r.level))) stats.levelAgreement++; else stats.levelDisagreement++;
          continue;
        }
      }
      const x = resolveDrug(idA), y = resolveDrug(idB);
      if (x === null || y === null) { stats.skippedNameConflicts++; continue; }
      const a = Math.min(x, y), b = Math.max(x, y);
      const sourceRecords: SourceInteractionRecord[] = records.map((r) => ({
        source: DDINTER.source, drugAId: idA, drugBId: idB, level: r.level, url: interactionPageUrl(r.interactionId),
        origin: 'website-listing', listingUrl: drugPageUrl(r.drugId), retrievedAt: r.retrievedAt,
      }));
      const order: ListingLevel[] = ['Unknown', 'Minor', 'Moderate', 'Major'];
      const levels = order.filter((l) => records.some((r) => r.level === l));
      const condition = `DDInter 2.0 risk level: ${levels.join(' / ')}. Recorded on the DDInter 2.0 website (${sourceRecords.map((r) => r.url).join(', ')}); this pair is not in the official category CSV exports. Mechanism description and management guidance are not stored for this pair.`;
      insEdge.run(a, b, x, condition, JSON.stringify(sourceRecords), sourceSeverity(levels));
      for (const r of records) insRecord.run(a, b, x, condition, r.level, idA, idB, `website-listing:${r.drugId}:interact/${r.interactionId}@${r.retrievedAt}`);
      stats.addedPairs++;
      const label = levels.join('/');
      stats.addedByLevel[label] = (stats.addedByLevel[label] ?? 0) + 1;
    }
  })();
  return stats;
}
