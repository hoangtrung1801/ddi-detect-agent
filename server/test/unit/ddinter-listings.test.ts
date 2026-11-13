import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { buildDdiDb } from '../../src/domain/build-db.ts';
import { DrugDb } from '../../src/domain/drug-db.ts';
import { applyInteractionDetail } from '../../src/domain/ddinter-details.ts';
import { applyListingSupplement, crawlInteractionListings, parseListingPage, readListingEntries, type ListingEntry } from '../../src/domain/ddinter-listings.ts';
import { RunContext, computePairs } from '../../src/agent/context.ts';
import { buildReport } from '../../src/agent/guard.ts';
import { Resolver } from '../../src/domain/resolver.ts';
import { formatPair } from '../../src/agent/tools/check-interactions.ts';

const row = (drugId: string, partnerId: string, partnerName: string, interactionId: number, level: number) => ({
  drug_id: partnerId, drug_name: partnerName, interaction_id: interactionId, level, metabolism: '0', synergistic_effect: '1', _of: drugId,
});
const listingBody = (drugId: string, rows: ReturnType<typeof row>[], total = rows.length) =>
  JSON.stringify({ draw: 1, recordsTotal: total, recordsFiltered: total, data: rows.filter((r) => r._of === drugId) });

/** Alpha–Beta and Alpha–Gamma are in the CSV export; Beta–Gamma is not (neither is in an exported ATC group). */
function catalog(db: Database.Database) {
  buildDdiDb(db, [
    { drug_1: 'Alpha', drug_2: 'Beta', condition: 'CSV', drug_1_id: 'DDInter1', drug_2_id: 'DDInter2', level: 'Moderate', source_rows: 'A.csv:2' },
    { drug_1: 'Alpha', drug_2: 'Gamma', condition: 'CSV', drug_1_id: 'DDInter1', drug_2_id: 'DDInter3', level: 'Minor', source_rows: 'A.csv:3' },
  ]);
}
const entry = (drugId: string, partnerId: string, partnerName: string, interactionId: number, level: ListingEntry['level']): ListingEntry =>
  ({ drugId, partnerId, partnerName, interactionId, level, retrievedAt: '2026-11-12T00:00:00.000Z' });

describe('DDInter interaction listings', () => {
  it('maps integer levels and rejects anything that is not a well-formed listing', () => {
    const body = JSON.stringify({ recordsTotal: 4, recordsFiltered: 4, data: [0, 1, 2, 3].map((level) => ({ drug_id: `DDInter${level + 10}`, drug_name: ` Drug  ${level} `, interaction_id: 100 + level, level })) });
    const page = parseListingPage(body, 'DDInter1', 0, 't');
    expect(page.total).toBe(4);
    expect(page.entries.map((e) => e.level)).toEqual(['Unknown', 'Minor', 'Moderate', 'Major']);
    expect(page.entries[0]).toEqual({ drugId: 'DDInter1', partnerId: 'DDInter10', partnerName: 'Drug 0', interactionId: 100, level: 'Unknown', retrievedAt: 't' });
    const bad = (data: unknown[]) => JSON.stringify({ recordsTotal: 1, recordsFiltered: 1, data });
    expect(() => parseListingPage(bad([{ drug_id: 'DDInter2', drug_name: 'B', interaction_id: 5, level: 4 }]), 'DDInter1', 0, 't')).toThrow(/unexpected level/);
    expect(() => parseListingPage(bad([{ drug_id: 'X2', drug_name: 'B', interaction_id: 5, level: 1 }]), 'DDInter1', 0, 't')).toThrow(/partner id/);
    expect(() => parseListingPage(bad([{ drug_id: 'DDInter2', drug_name: '', interaction_id: 5, level: 1 }]), 'DDInter1', 0, 't')).toThrow(/name/);
    expect(() => parseListingPage(bad([]), 'DDInter1', 0, 't')).toThrow(/empty page/);
    const self = parseListingPage(bad([{ drug_id: 'DDInter1', drug_name: 'Alpha', interaction_id: 9, level: 2 }]), 'DDInter1', 0, 't');
    expect(self).toEqual({ total: 1, entries: [], selfPages: [9] });
    expect(() => parseListingPage('<html>Forbidden</html>', 'DDInter1', 0, 't')).toThrow(/not JSON/);
  });

  it('adds only website-listed pairs missing from the CSV, with the listed level and page URL', async () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    catalog(db);
    const stats = applyListingSupplement(db, [
      entry('DDInter1', 'DDInter2', 'Beta', 10, 'Major'), // CSV says Moderate: reported, never overwritten
      entry('DDInter1', 'DDInter3', 'Gamma', 11, 'Minor'),
      entry('DDInter2', 'DDInter3', 'Gamma', 20, 'Major'),
      entry('DDInter3', 'DDInter2', 'Beta', 20, 'Major'), // same page seen from the other endpoint
      entry('DDInter3', 'DDInter4', 'Delta', 30, 'Unknown'), // partner absent from the CSV exports
      entry('DDInter3', 'DDInter5', 'ALPHA', 40, 'Major'), // different DDInter id, same normalized name as a catalog drug
    ]);
    expect(stats).toMatchObject({
      listedPairs: 5, pairsAlreadyInCsv: 2, levelAgreement: 1, levelDisagreement: 1,
      addedPairs: 2, addedByLevel: { Major: 1, Unknown: 1 }, addedDrugs: 1, addedDrugNames: ['Delta'], skippedNameConflicts: 1,
    });
    expect(db.pragma('foreign_key_check')).toEqual([]);
    const drugDb = new DrugDb(db);
    try {
      expect(drugDb.stats()).toEqual({ drugs: 4, interactions: 4 });
      const get = (n: string) => drugDb.getDrug(n)!;
      expect(drugDb.lookupPair(get('Alpha'), get('Beta'))!.sourceSeverity).toBe('moderate');
      const added = drugDb.lookupPair(get('Gamma'), get('Beta'))!;
      expect(added.sourceSeverity).toBe('major');
      expect(added.sourceRecords).toEqual([{
        source: 'DDInter 2.0', drugAId: 'DDInter2', drugBId: 'DDInter3', level: 'Major', url: 'https://ddinter2.scbdd.com/server/interact/20/',
        origin: 'website-listing', listingUrl: 'https://ddinter2.scbdd.com/server/drug-detail/DDInter2/', retrievedAt: '2026-11-12T00:00:00.000Z',
      }]);
      expect(added.condition).toMatch(/not in the official category CSV exports/);
      // Unknown is not graded as minor.
      expect(drugDb.lookupPair(get('Gamma'), get('Delta'))!.sourceSeverity).toBeUndefined();
      expect(get('Delta').id).toBe(4);
      const resolver = new Resolver({ drugDb, vectors: null, embedder: null });
      const before = new RunContext({ drugDb, resolver, linkFn: async () => ({ url: 'https://example.org', verified: false }) });
      for (const n of ['Beta', 'Gamma']) before.addResolved(await resolver.resolve(n));
      before.pairs = computePairs(before);
      expect(before.pairs[0]?.status).toBe('interaction');
      expect(formatPair(before.pairs[0]!)).toContain('SOURCE https://ddinter2.scbdd.com/server/interact/20/ [DDInter 2.0 website interaction listing, not the CSV export; listing risk=Major;');
      // Page details can now attach to the supplemented pair.
      expect(applyInteractionDetail(db, {
        pageId: 20, drugAId: 'DDInter2', drugBId: 'DDInter3', drugAName: 'Beta', drugBName: 'Gamma', level: 'Major', mechanisms: [],
        description: 'Beta potentiates Gamma.', management: 'Avoid.', references: [], url: 'https://ddinter2.scbdd.com/server/interact/20/', retrievedAt: 't', sha256: 'x',
      })).toBe(true);
      const ctx = new RunContext({ drugDb, resolver, linkFn: async () => ({ url: 'https://example.org', verified: false }) });
      for (const n of ['Beta', 'Gamma']) ctx.addResolved(await resolver.resolve(n));
      ctx.pairs = computePairs(ctx);
      const report = await buildReport({ title: 'Listing', pairs: [], recommendations: [] }, ctx);
      expect(report.pairs[0]?.severity).toBe('major');
      expect(report.pairs[0]?.source_records?.[0]).toMatchObject({ origin: 'website-listing', url: 'https://ddinter2.scbdd.com/server/interact/20/' });
      expect(report.pairs[0]?.source_records?.[0]?.details?.[0]?.management).toBe('Avoid.');
    } finally { drugDb.close(); }
  });

  it('crawls listings breadth-first across pages, follows new partners, and resumes without refetching', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ddi-listings-'));
    const database = join(dir, 'ddi.sqlite'), archive = join(dir, 'listings.sqlite');
    const db = new Database(database); catalog(db); db.close();
    const rows = [
      row('DDInter1', 'DDInter2', 'Beta', 10, 2), row('DDInter1', 'DDInter3', 'Gamma', 11, 1),
      row('DDInter2', 'DDInter1', 'Alpha', 10, 2), row('DDInter2', 'DDInter3', 'Gamma', 20, 3),
      row('DDInter3', 'DDInter1', 'Alpha', 11, 1), row('DDInter3', 'DDInter3', 'Gamma', 99, 2), row('DDInter3', 'DDInter2', 'Beta', 20, 3), row('DDInter3', 'DDInter4', 'Delta', 30, 0),
      row('DDInter4', 'DDInter3', 'Gamma', 30, 0),
    ];
    const requests: string[] = [];
    let denyListings = false;
    const server = createServer(async (req, res) => {
      if (req.url === '/robots.txt') { res.writeHead(404).end(); return; }
      if (req.url === '/server/interaction/') { res.end("<script>csrfmiddlewaretoken: 'public-token'</script>"); return; }
      const drug = req.url?.match(/^\/server\/interact-with\/(DDInter\d+)\/$/)?.[1];
      if (drug && req.method === 'POST') {
        let body = ''; for await (const chunk of req) body += chunk;
        const form = new URLSearchParams(body);
        if (denyListings || form.get('csrfmiddlewaretoken') !== 'public-token') { res.writeHead(403).end(); return; }
        const start = Number(form.get('start')), length = Number(form.get('length'));
        requests.push(`${drug}@${start}`);
        const mine = rows.filter((r) => r._of === drug);
        res.setHeader('Content-Type', 'application/json');
        res.end(listingBody(drug, mine.slice(start, start + length), mine.length)); return;
      }
      res.writeHead(404).end();
    });
    const listening = once(server, 'listening'); server.listen(0, '127.0.0.1'); await listening;
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP server');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    try {
      const first = await crawlInteractionListings({ database, archive, baseUrl, intervalMs: 0, pageSize: 2, maxRequests: 2 });
      expect(first.state).toBe('paused');
      const done = await crawlInteractionListings({ database, archive, baseUrl, intervalMs: 0, pageSize: 2 });
      expect(done).toMatchObject({ state: 'completed', seedDrugs: 3, queuedDrugs: 4, completedDrugs: 4, entries: 8, pairs: 4, selfPages: 1 });
      // Each page fetched exactly once across both runs; Delta (not in the catalog) was followed.
      expect(requests.toSorted()).toEqual(['DDInter1@0', 'DDInter2@0', 'DDInter3@0', 'DDInter3@2', 'DDInter4@0']);
      const store = new Database(archive, { readonly: true });
      const { entries, complete } = readListingEntries(store); store.close();
      expect(complete).toBe(true);
      const main = new Database(database);
      expect(applyListingSupplement(main, entries)).toMatchObject({ addedPairs: 2, addedDrugs: 1, levelAgreement: 2, levelDisagreement: 0 });
      main.close();
      // Access denial stops a fresh crawl without bypass attempts.
      denyListings = true;
      await expect(crawlInteractionListings({ database, archive: join(dir, 'denied.sqlite'), baseUrl, intervalMs: 0 })).rejects.toThrow(/access denied/);
    } finally {
      server.closeAllConnections(); const closed = once(server, 'close'); server.close(); await closed;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
