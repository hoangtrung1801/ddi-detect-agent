import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { buildDdiDb } from '../../src/domain/build-db.ts';
import { DrugDb } from '../../src/domain/drug-db.ts';
import { parseInteractionPage, applyInteractionDetail } from '../../src/domain/ddinter-details.ts';
import { crawlInteractionDetails, discoveryDrugs } from '../../src/domain/ddinter-crawler.ts';
import { RunContext, computePairs } from '../../src/agent/context.ts';
import { buildReport } from '../../src/agent/guard.ts';
import { Resolver } from '../../src/domain/resolver.ts';
import { formatPair } from '../../src/agent/tools/check-interactions.ts';

function pageHTML(management = 'Monitor exposure.', level = 'Major') {
  return `<main><div role="alert"><strong>Alpha</strong> and <strong>Beta</strong><span class="badge">${level}</span><span class="badge">Metabolism</span></div>
    <table><tr><td class="key">ID</td><td class="value"><a>DDInter1</a> and <a>DDInter2</a></td></tr>
    <tr><td class="key">Interaction</td><td class="value">Alpha &amp; Beta affect exposure.<br>Evidence is limited.</td></tr>
    <tr><td class="key">Management</td><td class="value">${management}</td></tr>
    <tr><td class="key">References</td><td class="value"><span>[1] Study A</span><span>[2] Label B</span></td></tr>
    <tr><td class="key">Alternative for Alpha</td><td class="value">Not a personalized substitution.</td></tr></table>
    <blockquote>Generic CYP footer: lower the dose.</blockquote></main>`;
}

function createCatalog(path: string) {
  const db = new Database(path);
  buildDdiDb(db, [{ drug_1: 'Alpha', drug_2: 'Beta', condition: 'CSV risk only', drug_1_id: 'DDInter1', drug_2_id: 'DDInter2', level: 'Moderate', source_rows: 'A.csv:2' }]);
  db.close();
}

async function listen(server: Server) {
  const listening = once(server, 'listening');
  server.listen(0, '127.0.0.1');
  await listening;
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP server');
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: Server) {
  server.closeAllConnections();
  const closed = once(server, 'close');
  server.close();
  await closed;
}

describe('DDInter page evidence', () => {
  it('extracts source fields, decodes entities, and excludes generic footer/alternative guidance', () => {
    const detail = parseInteractionPage(pageHTML('-'), 777, '2026-10-23T00:00:00Z');
    expect(detail.description).toBe('Alpha & Beta affect exposure. Evidence is limited.');
    expect(detail.management).toBeNull();
    expect(detail.references).toEqual(['[1] Study A', '[2] Label B']);
    expect(detail.mechanisms).toEqual(['Metabolism']);
    expect(detail.drugAId).toBe('DDInter1');
    expect(detail.description).not.toContain('Generic CYP');
    expect(detail.management).not.toBe('Not a personalized substitution.');
    expect(() => parseInteractionPage('<html>Access denied</html>', 777, '2026-10-23')).toThrow(/banner/);
  });

  it('preserves CSV severity when the crawled page disagrees, and exposes cited evidence to reports and tools', async () => {
    const db = new Database(':memory:');
    buildDdiDb(db, [{ drug_1: 'Alpha', drug_2: 'Beta', condition: 'CSV risk only', drug_1_id: 'DDInter1', drug_2_id: 'DDInter2', level: 'Moderate' }]);
    const drugDb = new DrugDb(db);
    try {
      const detail = parseInteractionPage(pageHTML(), 777, '2026-10-23T00:00:00Z');
      expect(applyInteractionDetail(db, detail)).toBe(true);
      expect(applyInteractionDetail(db, { ...detail, pageId: 778, drugBId: 'DDInter99' })).toBe(false);
      expect(drugDb.stats()).toEqual({ drugs: 2, interactions: 1 });
      const record = drugDb.lookupPair(drugDb.getDrug('Alpha')!, drugDb.getDrug('Beta')!)!;
      expect(record.sourceSeverity).toBe('moderate');
      expect(record.sourceRecords?.[0]?.details?.[0]?.level).toBe('Major');
      expect(record.sourceRecords?.[0]?.url).toBe(detail.url);
      expect(record.condition).toBe(detail.description);
      const resolver = new Resolver({ drugDb, vectors: null, embedder: null });
      const ctx = new RunContext({ drugDb, resolver, linkFn: async () => ({ url: 'https://example.org', verified: false }) });
      for (const n of ['Alpha', 'Beta']) ctx.addResolved(await resolver.resolve(n));
      ctx.pairs = computePairs(ctx);
      expect(formatPair(ctx.pairs[0]!)).toContain('Management (source quote): Monitor exposure.');
      const report = await buildReport({ title: 'Evidence', pairs: [], recommendations: [] }, ctx);
      expect(report.pairs[0]?.source_records?.[0]?.details?.[0]).toEqual(detail);
      expect(report.pairs[0]?.severity).toBe('moderate');
    } finally { drugDb.close(); }
  });
});

describe('resumable HTTP enrichment', () => {
  it('discovers only current pairs, imports real fields, and resumes without refetching completed pages', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ddi-crawl-'));
    const database = join(dir, 'ddi.sqlite'), archivePath = join(dir, 'crawl.sqlite');
    createCatalog(database);
    let detailRequests = 0, outOfScopeRequests = 0;
    const server = createServer(async (req, res) => {
      if (req.url === '/robots.txt') { res.writeHead(404).end(); return; }
      if (req.url === '/server/interaction/') { res.end("<script>csrfmiddlewaretoken: 'public-token'</script>"); return; }
      if (req.url === '/server/interact-with/DDInter1/') {
        let body = ''; for await (const chunk of req) body += chunk;
        if (new URLSearchParams(body).get('csrfmiddlewaretoken') !== 'public-token') { res.writeHead(403).end(); return; }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ recordsTotal: 2, recordsFiltered: 2, data: [{ drug_id: 'DDInter2', interaction_id: 777 }, { drug_id: 'DDInter99', interaction_id: 888 }] })); return;
      }
      if (req.url === '/server/interact/777/') { detailRequests++; res.end(pageHTML()); return; }
      outOfScopeRequests++; res.writeHead(404).end();
    });
    const baseUrl = await listen(server);
    try {
      const options = { database, archive: archivePath, baseUrl, intervalMs: 0 };
      const first = await crawlInteractionDetails({ ...options, maxPages: 1 });
      expect(first.state).toBe('paused'); expect(first.enrichedPairs).toBe(1);
      const second = await crawlInteractionDetails(options);
      expect(second.state).toBe('completed'); expect(detailRequests).toBe(1); expect(outOfScopeRequests).toBe(0);
      const archive = new Database(archivePath, { readonly: true });
      const page = archive.prepare('SELECT html_gzip FROM pages WHERE id=?').get(777) as { html_gzip: Buffer };
      expect(parseInteractionPage(gunzipSync(page.html_gzip).toString(), 777, '2026-10-23').management).toBe('Monitor exposure.');
      archive.close();
    } finally { await close(server); rmSync(dir, { recursive: true, force: true }); }
  });

  it('stops on access denial and does not mark the target as successfully enriched', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ddi-denied-'));
    const database = join(dir, 'ddi.sqlite'); createCatalog(database);
    let requests = 0;
    const server = createServer((_req, res) => { requests++; res.writeHead(403).end('Denied'); });
    const baseUrl = await listen(server);
    try {
      await expect(crawlInteractionDetails({ database, archive: join(dir, 'crawl.sqlite'), baseUrl, intervalMs: 0 })).rejects.toThrow(/access denied/);
      expect(requests).toBe(1);
      const db = new Database(database, { readonly: true });
      expect(db.prepare('SELECT COUNT(*) n FROM interaction_details').get()).toEqual({ n: 0 }); db.close();
    } finally { await close(server); rmSync(dir, { recursive: true, force: true }); }
  });

  describe('concurrent crawling', () => {
    const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta'];
    const starHtml = (n: number) => pageHTML().replace('<a>DDInter2</a>', `<a>DDInter${n}</a>`);
    function createStarCatalog(path: string) {
      const db = new Database(path);
      buildDdiDb(db, names.slice(1).map((name, i) => ({ drug_1: 'Alpha', drug_2: name, condition: 'CSV risk only', drug_1_id: 'DDInter1', drug_2_id: `DDInter${i + 2}`, level: 'Moderate', source_rows: `A.csv:${i + 2}` })));
      db.close();
    }
    function starServer(onDetail: (id: number, res: import('node:http').ServerResponse) => void) {
      return createServer(async (req, res) => {
        if (req.url === '/robots.txt') { res.writeHead(404).end(); return; }
        if (req.url === '/server/interaction/') { res.end("<script>csrfmiddlewaretoken: 'public-token'</script>"); return; }
        if (req.url === '/server/interact-with/DDInter1/') {
          for await (const _ of req) { /* drain */ }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ recordsTotal: 5, recordsFiltered: 5, data: [2, 3, 4, 5, 6].map((n) => ({ drug_id: `DDInter${n}`, interaction_id: 700 + n })) })); return;
        }
        const id = Number(req.url?.match(/^\/server\/interact\/(\d+)\/$/)?.[1]);
        if (id) { onDetail(id, res); return; }
        res.writeHead(404).end();
      });
    }

    it('keeps in-flight requests within the concurrency cap and enriches every pair', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'ddi-conc-'));
      const database = join(dir, 'ddi.sqlite'); createStarCatalog(database);
      let inFlight = 0, maxInFlight = 0;
      const server = starServer((id, res) => {
        inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
        setTimeout(() => { inFlight--; res.end(starHtml(id - 700)); }, 40);
      });
      const baseUrl = await listen(server);
      try {
        const status = await crawlInteractionDetails({ database, archive: join(dir, 'crawl.sqlite'), baseUrl, intervalMs: 0, concurrency: 3 });
        expect(status.state).toBe('completed'); expect(status.enrichedPairs).toBe(5);
        expect(maxInFlight).toBeGreaterThan(1); expect(maxInFlight).toBeLessThanOrEqual(3);
      } finally { await close(server); rmSync(dir, { recursive: true, force: true }); }
    });

    it('spaces request starts by the shared interval across workers', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'ddi-pace-'));
      const database = join(dir, 'ddi.sqlite'); createStarCatalog(database);
      const starts: number[] = [];
      const server = starServer((id, res) => { starts.push(Date.now()); res.end(starHtml(id - 700)); });
      const baseUrl = await listen(server);
      try {
        await crawlInteractionDetails({ database, archive: join(dir, 'crawl.sqlite'), baseUrl, intervalMs: 60, concurrency: 5 });
        expect(starts).toHaveLength(5);
        // Unpaced workers would arrive within milliseconds; allow slack for cold-connection jitter at the server.
        expect(Math.max(...starts) - Math.min(...starts)).toBeGreaterThanOrEqual(120);
      } finally { await close(server); rmSync(dir, { recursive: true, force: true }); }
    });

    it('halts every worker on HTTP 429 and records the Retry-After deadline', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'ddi-429-'));
      const database = join(dir, 'ddi.sqlite'); createStarCatalog(database);
      let detailRequests = 0;
      const server = starServer((_id, res) => { detailRequests++; res.writeHead(429, { 'Retry-After': '120' }).end(); });
      const baseUrl = await listen(server);
      try {
        const archivePath = join(dir, 'crawl.sqlite');
        await expect(crawlInteractionDetails({ database, archive: archivePath, baseUrl, intervalMs: 0, concurrency: 3 })).rejects.toThrow(/429/);
        expect(detailRequests).toBeLessThanOrEqual(3);
        await expect(crawlInteractionDetails({ database, archive: archivePath, baseUrl, intervalMs: 0, concurrency: 3 })).rejects.toThrow(/Rate-limit deadline/);
        expect(detailRequests).toBeLessThanOrEqual(3);
      } finally { await close(server); rmSync(dir, { recursive: true, force: true }); }
    });
  });

  it('chooses discovery endpoints that cover every target pair', () => {
    const targets = [
      { a: 1, b: 2, source_a: 'DDInter1', source_b: 'DDInter2' },
      { a: 1, b: 3, source_a: 'DDInter1', source_b: 'DDInter3' },
      { a: 2, b: 3, source_a: 'DDInter2', source_b: 'DDInter3' },
    ];
    const selected = new Set(discoveryDrugs(targets));
    for (const target of targets) expect(selected.has(target.source_a) || selected.has(target.source_b)).toBe(true);
  });
});
