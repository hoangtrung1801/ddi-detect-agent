import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { gzipSync } from 'node:zlib';
import Database from 'better-sqlite3';
import { applyInteractionDetail, createInteractionDetailsTable, parseInteractionPage } from './ddinter-details.ts';

interface Target { a: number; b: number; source_a: string; source_b: string }
interface ListingRow { drug_id: string; interaction_id: number }
interface Listing { recordsTotal: number; recordsFiltered: number; data: ListingRow[] }
export interface CrawlOptions {
  database: string;
  archive: string;
  /** Minimum spacing between request starts, shared by all workers. */
  intervalMs?: number;
  /** Maximum requests in flight at once. */
  concurrency?: number;
  maxPages?: number;
  pageIds?: number[];
  signal?: AbortSignal;
  onProgress?: (status: CrawlStatus) => void;
  /** Local HTTP server seam for deterministic integration tests. CLI always uses DDInter. */
  baseUrl?: string;
}
export interface CrawlStatus {
  state: string;
  targetPairs: number;
  discoveredPairs: number;
  completedPages: number;
  enrichedPairs: number;
  pendingPages: number;
  missingPages: number;
  failedPages: number;
  discoveryJobsRemaining: number;
  descriptions: number;
  management: number;
  error: string | null;
}

export function crawlStatus(archive: Database.Database): CrawlStatus {
  const counts = archive.prepare(`SELECT
    (SELECT COUNT(*) FROM targets) targetPairs,
    (SELECT COUNT(*) FROM (SELECT a,b FROM pages GROUP BY a,b)) discoveredPairs,
    (SELECT COUNT(*) FROM pages WHERE state='done') completedPages,
    (SELECT COUNT(*) FROM (SELECT a,b FROM pages WHERE state='done' GROUP BY a,b)) enrichedPairs,
    (SELECT COUNT(*) FROM pages WHERE state='pending') pendingPages,
    (SELECT COUNT(*) FROM pages WHERE state='missing') missingPages,
    (SELECT COUNT(*) FROM pages WHERE state='error') failedPages,
    (SELECT COUNT(*) FROM discovery WHERE complete=0) discoveryJobsRemaining,
    (SELECT COUNT(*) FROM pages WHERE state='done' AND json_extract(detail_json,'$.description') IS NOT NULL) descriptions,
    (SELECT COUNT(*) FROM pages WHERE state='done' AND json_extract(detail_json,'$.management') IS NOT NULL) management`).get() as Omit<CrawlStatus, 'state' | 'error'>;
  const meta = Object.fromEntries((archive.prepare('SELECT key,value FROM metadata').all() as { key: string; value: string }[]).map((r) => [r.key, r.value]));
  return { ...counts, state: meta.state ?? 'not_started', error: meta.error || null };
}

/** Greedy vertex cover: each target pair is indexed through at least one endpoint, without querying every drug. */
export function discoveryDrugs(targets: Target[]): string[] {
  const adjacent = new Map<string, Set<string>>();
  for (const t of targets) {
    if (!adjacent.has(t.source_a)) adjacent.set(t.source_a, new Set());
    if (!adjacent.has(t.source_b)) adjacent.set(t.source_b, new Set());
    adjacent.get(t.source_a)!.add(t.source_b);
    adjacent.get(t.source_b)!.add(t.source_a);
  }
  const selected: string[] = [];
  for (;;) {
    let best: string | undefined;
    let degree = 0;
    for (const [id, neighbors] of adjacent) if (neighbors.size > degree) { best = id; degree = neighbors.size; }
    if (!best) return selected;
    selected.push(best);
    for (const neighbor of adjacent.get(best)!) adjacent.get(neighbor)!.delete(best);
    adjacent.get(best)!.clear();
  }
}

export async function crawlInteractionDetails(options: CrawlOptions): Promise<CrawlStatus> {
  const main = new Database(options.database, { fileMustExist: true });
  const archive = new Database(options.archive);
  main.pragma('busy_timeout = 10000');
  main.pragma('foreign_keys = ON');
  archive.pragma('journal_mode = WAL');
  archive.pragma('busy_timeout = 10000');
  createInteractionDetailsTable(main);
  archive.exec(`CREATE TABLE IF NOT EXISTS targets(a INTEGER,b INTEGER,source_a TEXT,source_b TEXT,PRIMARY KEY(a,b));
    CREATE TABLE IF NOT EXISTS discovery(drug_id TEXT PRIMARY KEY,offset INTEGER NOT NULL DEFAULT 0,complete INTEGER NOT NULL DEFAULT 0,total INTEGER);
    CREATE TABLE IF NOT EXISTS listings(drug_id TEXT,offset INTEGER,total INTEGER,returned INTEGER,sha256 TEXT,retrieved_at TEXT,PRIMARY KEY(drug_id,offset));
    CREATE TABLE IF NOT EXISTS pages(id INTEGER PRIMARY KEY,a INTEGER,b INTEGER,state TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,error TEXT,html_gzip BLOB,detail_json TEXT);
    CREATE INDEX IF NOT EXISTS pages_pair ON pages(a,b);
    CREATE INDEX IF NOT EXISTS pages_state ON pages(state,id);
    CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
  const meta = archive.prepare('INSERT INTO metadata(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  const targets = main.prepare(`SELECT i.a,i.b,a.source_id source_a,b.source_id source_b FROM interactions i
    JOIN drugs a ON a.id=i.a JOIN drugs b ON b.id=i.b ORDER BY i.a,i.b`).all() as Target[];
  if (!targets.length || targets.some((t) => !t.source_a || !t.source_b)) throw new Error('Expected a nonempty DDInter source-ID catalog');
  const signature = createHash('sha256').update(JSON.stringify(targets)).digest('hex');
  const previous = archive.prepare('SELECT value FROM metadata WHERE key=?').get('catalog_sha256') as { value: string } | undefined;
  if (previous && previous.value !== signature) { main.close(); archive.close(); throw new Error('Crawl archive belongs to a different catalog; use a new archive path'); }
  if (!previous) {
    archive.transaction(() => {
      const insert = archive.prepare('INSERT INTO targets VALUES (?,?,?,?)');
      for (const t of targets) insert.run(t.a, t.b, t.source_a, t.source_b);
      const job = archive.prepare('INSERT INTO discovery(drug_id) VALUES (?)');
      for (const id of discoveryDrugs(targets)) job.run(id);
      meta.run('catalog_sha256', signature);
      meta.run('created_at', new Date().toISOString());
    })();
  }
  const targetByPair = new Map(targets.map((t) => [[t.source_a, t.source_b].sort().join('|'), t]));
  const targetByLocalPair = new Map(targets.map((t) => [`${t.a}:${t.b}`, t]));
  const insertPage = archive.prepare('INSERT INTO pages(id,a,b) VALUES (?,?,?) ON CONFLICT(id) DO NOTHING');
  let cookie = '';
  let token = '';
  let nextSlot = 0;
  let halted: Error | undefined;
  let fetched = 0;
  let actions = 0;
  const base = options.baseUrl ?? 'https://ddinter2.scbdd.com';
  const intervalMs = options.intervalMs ?? 250;
  const concurrency = options.concurrency ?? 4;
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) throw new Error('concurrency must be a positive integer');
  const request = async (path: string, body?: URLSearchParams): Promise<Response> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      options.signal?.throwIfAborted();
      if (halted) throw halted;
      // Reserve the next start slot synchronously so concurrent workers stay evenly spaced.
      const slot = Math.max(nextSlot, Date.now());
      nextSlot = slot + intervalMs;
      if (slot > Date.now()) await sleep(slot - Date.now(), undefined, { signal: options.signal });
      if (halted) throw halted;
      const headers = new Headers({ 'User-Agent': 'DDI-Research-Enrichment/1.0 (+https://github.com/hoangtrung1801/ddi-detect-agent)', Referer: `${base}/server/interaction/` });
      if (cookie) headers.set('Cookie', cookie);
      if (body) { body.set('csrfmiddlewaretoken', token); headers.set('Content-Type', 'application/x-www-form-urlencoded'); }
      const response = await fetch(`${base}${path}`, { method: body ? 'POST' : 'GET', headers, body, signal: AbortSignal.any([AbortSignal.timeout(60000), ...(options.signal ? [options.signal] : [])]) });
      const cookies = response.headers.getSetCookie();
      if (cookies.length) cookie = cookies.map((c) => c.split(';')[0]).join('; ');
      if (response.status === 429) {
        const value = response.headers.get('retry-after');
        const until = value && /^\d+$/.test(value) ? Date.now() + Number(value) * 1000 : value ? Date.parse(value) : Date.now() + 60000;
        meta.run('retry_after', String(Number.isFinite(until) ? until : Date.now() + 60000));
        await response.body?.cancel();
        throw (halted = new Error('HTTP 429: crawl paused; resume after the Retry-After deadline recorded in the archive'));
      }
      if (response.status === 401 || response.status === 403) { await response.body?.cancel(); throw (halted = new Error(`HTTP ${response.status}: access denied; no bypass attempted`)); }
      if (response.status >= 500 && attempt < 2) { await response.body?.cancel(); await sleep(2000 * 2 ** attempt, undefined, { signal: options.signal }); continue; }
      return response;
    }
    throw new Error('Request retry exhausted');
  };
  const publish = () => { meta.run('updated_at', new Date().toISOString()); options.onProgress?.(crawlStatus(archive)); };
  const savePage = async (id: number, target?: Target) => {
    archive.prepare('UPDATE pages SET attempts=attempts+1 WHERE id=?').run(id);
    try {
      const response = await request(`/server/interact/${id}/`);
      if (response.status === 404 || response.status === 410) {
        archive.prepare("UPDATE pages SET state='missing',error=? WHERE id=?").run(`HTTP ${response.status}`, id);
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status} for interaction ${id}`);
      const html = await response.text();
      const detail = parseInteractionPage(html, id, new Date().toISOString());
      const match = targetByPair.get([detail.drugAId, detail.drugBId].sort().join('|'));
      if (!match || (target && (match.a !== target.a || match.b !== target.b))) throw new Error(`Interaction ${id} does not match its current-database target pair`);
      if (!target) insertPage.run(id, match.a, match.b);
      if (!applyInteractionDetail(main, detail)) throw new Error(`Target pair disappeared for interaction ${id}`);
      archive.prepare("UPDATE pages SET state='done',error=NULL,html_gzip=?,detail_json=? WHERE id=?").run(gzipSync(html), JSON.stringify(detail), id);
      fetched++;
      if (fetched === 1 || ++actions % 100 === 0) publish();
    } catch (error) {
      archive.prepare("UPDATE pages SET state='error',error=? WHERE id=?").run(String(error), id);
      throw error;
    }
  };
  const discover = async (job: { drug_id: string; offset: number }) => {
    const response = await request(`/server/interact-with/${job.drug_id}/`, new URLSearchParams({ start: String(job.offset), length: '100', draw: '1', severity: '', mechanism: '' }));
    if (!response.ok) throw new Error(`Pair listing HTTP ${response.status}`);
    const body = await response.text();
    const listing = JSON.parse(body) as Listing;
    if (!Number.isInteger(listing.recordsTotal) || listing.recordsTotal < 0 || listing.recordsTotal !== listing.recordsFiltered || !Array.isArray(listing.data) || (!listing.data.length && job.offset < listing.recordsTotal)) throw new Error(`Invalid/unexpected listing response for ${job.drug_id}`);
    archive.transaction(() => {
      for (const row of listing.data) {
        if (!/^DDInter\d+$/.test(row.drug_id) || !Number.isInteger(row.interaction_id) || row.interaction_id < 1) throw new Error('Malformed pair index entry');
        const target = targetByPair.get([job.drug_id, row.drug_id].sort().join('|'));
        if (target) insertPage.run(row.interaction_id, target.a, target.b);
      }
      const next = job.offset + listing.data.length;
      archive.prepare('UPDATE discovery SET offset=?,complete=?,total=? WHERE drug_id=?').run(next, Number(next >= listing.recordsTotal), listing.recordsTotal, job.drug_id);
      archive.prepare('INSERT OR REPLACE INTO listings VALUES (?,?,?,?,?,?)').run(job.drug_id, job.offset, listing.recordsTotal, listing.data.length, createHash('sha256').update(body).digest('hex'), new Date().toISOString());
    })();
    if (++actions % 100 === 0) publish();
  };
  /** Let every in-flight request finish and record its state, then surface the first failure. */
  const settleAll = async (work: Promise<unknown>[]) => {
    const results = await Promise.allSettled(work);
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failed) throw halted ?? failed.reason;
  };
  try {
    const retry = archive.prepare('SELECT value FROM metadata WHERE key=?').get('retry_after') as { value: string } | undefined;
    if (retry && Number(retry.value) > Date.now()) throw new Error(`Rate-limit deadline has not elapsed: ${new Date(Number(retry.value)).toISOString()}`);
    meta.run('state', 'running'); meta.run('error', '');
    archive.prepare("UPDATE pages SET state='pending' WHERE state='error'").run();
    const robots = await request('/robots.txt');
    if (robots.status !== 404) {
      if (!robots.ok || /^\s*Disallow:\s*\/\S*/im.test(await robots.text())) throw new Error('robots.txt requires manual access-rule review; crawl paused');
    }
    if (options.pageIds) {
      // Explicit IDs are useful for a bounded first run; only actual current pairs are ever stored/applied.
      for (const id of options.pageIds) {
        const saved = archive.prepare('SELECT detail_json FROM pages WHERE id=? AND state=?').get(id, 'done') as { detail_json: string } | undefined;
        if (saved) { applyInteractionDetail(main, JSON.parse(saved.detail_json)); continue; }
        await savePage(id);
      }
      meta.run('state', 'paused'); publish(); return crawlStatus(archive);
    }
    const bootstrap = await request('/server/interaction/');
    if (!bootstrap.ok) throw new Error(`Listing bootstrap HTTP ${bootstrap.status}`);
    const html = await bootstrap.text();
    token = html.match(/csrfmiddlewaretoken:\s*'([^']+)'/)?.[1] ?? '';
    // The public listing currently supplies an embedded token but no Set-Cookie header.
    // Send only session material actually issued by the site; a 401/403 always stops the crawl.
    if (!token) throw new Error('Public listing did not supply its normal CSRF token; no bypass attempted');
    for (;;) {
      options.signal?.throwIfAborted();
      if (options.maxPages !== undefined && fetched >= options.maxPages) { meta.run('state', 'paused'); break; }
      const room = options.maxPages === undefined ? concurrency : Math.min(concurrency, options.maxPages - fetched);
      const pending = archive.prepare("SELECT id,a,b FROM pages WHERE state='pending' ORDER BY id LIMIT ?").all(room) as { id: number; a: number; b: number }[];
      if (pending.length) {
        await settleAll(pending.map((page) => savePage(page.id, targetByLocalPair.get(`${page.a}:${page.b}`)!)));
        continue;
      }
      const jobs = archive.prepare('SELECT drug_id,offset FROM discovery WHERE complete=0 ORDER BY rowid LIMIT ?').all(concurrency) as { drug_id: string; offset: number }[];
      if (!jobs.length) {
        const status = crawlStatus(archive);
        meta.run('state', status.enrichedPairs === status.targetPairs && !status.missingPages && !status.failedPages ? 'completed' : 'completed_with_gaps');
        break;
      }
      await settleAll(jobs.map(discover));
    }
    publish();
    return crawlStatus(archive);
  } catch (error) {
    meta.run('state', options.signal?.aborted ? 'paused' : 'error');
    meta.run('error', String(error)); publish();
    if (!options.signal?.aborted) throw error;
    return crawlStatus(archive);
  } finally { main.close(); archive.close(); }
}
