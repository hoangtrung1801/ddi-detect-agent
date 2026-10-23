import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { preprocessDdinter, interactionCsv } from '../../src/domain/ddinter.ts';
import { parseInteractionCsv } from '../../src/util/csv.ts';
import { buildDdiDb } from '../../src/domain/build-db.ts';
import { DrugDb } from '../../src/domain/drug-db.ts';
import { Resolver } from '../../src/domain/resolver.ts';
import { RunContext, computePairs } from '../../src/agent/context.ts';
import { buildReport } from '../../src/agent/guard.ts';

const header = 'DDInterID_A,Drug_A,DDInterID_B,Drug_B,Level\n';

function domain(files: { name: string; text: string }[]) {
  const processed = preprocessDdinter(files);
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  buildDdiDb(db, parseInteractionCsv(interactionCsv(processed.rows)));
  const drugDb = new DrugDb(db);
  const resolver = new Resolver({ drugDb, vectors: null, embedder: null });
  return { processed, db, drugDb, resolver };
}

async function context(env: { drugDb: DrugDb; resolver: Resolver }, names: string[]) {
  const ctx = new RunContext({ drugDb: env.drugDb, resolver: env.resolver, linkFn: async () => ({ url: 'https://example.org/reference', verified: false }) });
  for (const name of names) ctx.addResolved(await env.resolver.resolve(name));
  ctx.pairs = computePairs(ctx);
  return ctx;
}

describe('DDInter migration', () => {
  it('deduplicates reverse category overlaps but retains every source row and distinct risk record', () => {
    const env = domain([
      { name: 'A.csv', text: header + 'DDInter1,Alpha,DDInter2,Beta,Major\nDDInter1,Alpha,DDInter2,Beta,Moderate\n' },
      { name: 'B.csv', text: header + 'DDInter2,Beta,DDInter1,Alpha,Major\n' },
    ]);
    try {
      expect(env.processed.sourceRows).toBe(3);
      expect(env.processed.duplicateRows).toBe(1);
      const record = env.drugDb.lookupPair(env.drugDb.getDrug('Alpha')!, env.drugDb.getDrug('Beta')!)!;
      expect(record.sourceRecords?.map((r) => r.level)).toEqual(['Major', 'Moderate']);
      expect(record.sourceSeverity).toBe('major');
      expect(env.db.prepare('SELECT source_rows FROM interaction_records WHERE level = ?').get('Major')).toEqual({ source_rows: 'A.csv:2;B.csv:2' });
      expect(env.drugDb.lookupPair(env.drugDb.getDrug('Beta')!, env.drugDb.getDrug('Alpha')!)).toEqual(record);
    } finally { env.drugDb.close(); }
  });

  it('rejects incomplete rows and conflicting source identities instead of silently excluding them', () => {
    expect(() => preprocessDdinter([{ name: 'bad.csv', text: header + 'DDInter1,Alpha,DDInter2,,Major\n' }])).toThrow(/incomplete/);
    expect(() => preprocessDdinter([{ name: 'bad.csv', text: header + 'DDInter1,Alpha,DDInter2,Beta,Major\nDDInter1,Other,DDInter2,Beta,Major\n' }])).toThrow(/Conflicting/);
    expect(() => preprocessDdinter([{ name: 'bad.csv', text: header + 'DDInter1,Alpha,DDInter2,Beta,Safe\n' }])).toThrow(/risk level/);
  });

  it('uses source severity even when the model disagrees, while retaining source identifiers', async () => {
    const env = domain([{ name: 'A.csv', text: header + 'DDInter1,Alpha,DDInter2,Beta,Major\n' }]);
    try {
      const ctx = await context(env, ['Alpha', 'Beta']);
      const report = await buildReport({ title: 'Report', pairs: [{ a: 'Alpha', b: 'Beta', severity: 'minor', explanation: 'AI interpretation' }], recommendations: [] }, ctx);
      expect(report.pairs[0]).toMatchObject({ severity: 'major', severity_source: 'DDInter 2.0', source_records: [{ drugAId: 'DDInter1', drugBId: 'DDInter2', level: 'Major' }] });
      expect(report.overall_risk).toBe('high');
    } finally { env.drugDb.close(); }
  });

  it('does not replace Unknown with a model estimate or turn absent/unknown drugs into safe pairs', async () => {
    const env = domain([{ name: 'A.csv', text: header + 'DDInter1,Alpha,DDInter2,Beta,Unknown\nDDInter3,Gamma,DDInter4,Delta,Minor\n' }]);
    try {
      const ctx = await context(env, ['Alpha', 'Beta', 'Gamma', 'nonexistent']);
      const report = await buildReport({ title: 'Report', pairs: [{ a: 'Alpha', b: 'Beta', severity: 'minor', explanation: 'AI interpretation' }], recommendations: [] }, ctx);
      expect(report.pairs[0]).toMatchObject({ status: 'interaction', severity_source: 'DDInter 2.0', source_records: [{ level: 'Unknown' }] });
      expect(report.pairs[0]?.severity).toBeUndefined();
      expect(report.overall_risk).toBe('unknown');
      expect(report.pairs.find((p) => p.a === 'Alpha' && p.b === 'Gamma')?.status).toBe('no_record');
      expect(report.pairs.find((p) => p.b === 'nonexistent')?.status).toBe('unresolved');
    } finally { env.drugDb.close(); }
  });

  it('aggregates source-backed ingredient risks without hiding Unknown behind a lower known risk', async () => {
    const env = domain([{ name: 'A.csv', text: header + 'DDInter1,Alpha,DDInter2,Beta,Minor\nDDInter3,Gamma,DDInter2,Beta,Unknown\nDDInter4,Delta,DDInter2,Beta,Major\n' }]);
    try {
      for (const [ingredients, severity] of [[['Alpha', 'Gamma'], undefined], [['Alpha', 'Gamma', 'Delta'], 'major']] as const) {
        const ctx = new RunContext({ drugDb: env.drugDb, resolver: env.resolver, linkFn: async () => ({ url: 'https://example.org/reference', verified: false }) }, undefined, [{ name: 'Product', ingredients: [...ingredients] }, { name: 'Beta', ingredients: [] }]);
        await ctx.resolveMembers();
        const pairs = computePairs(ctx);
        expect(pairs[0]?.sourceSeverity).toBe(severity);
        expect(pairs[0]?.sourceRecords?.map((r) => r.level)).toContain('Unknown');
      }
    } finally { env.drugDb.close(); }
  });

  it('keeps a broad substance unresolved rather than choosing a more-specific formulation by similarity', async () => {
    const env = domain([{ name: 'A.csv', text: header + 'DDInter1,Insulin detemir,DDInter2,Insulin glargine,Moderate\n' }]);
    try {
      const resolver = new Resolver({
        drugDb: env.drugDb,
        vectors: { names: ['Insulin detemir', 'Insulin glargine'], matrix: new Float32Array([1, 0, 0.9, Math.sqrt(0.19)]), dim: 2 },
        embedder: { dim: 2, embed: async () => [new Float32Array([1, 0])] },
      });
      const broad = await resolver.resolve('Insulin');
      expect(broad.dbName).toBeNull();
      expect(broad.alternatives.map((a) => a.name)).toEqual(['Insulin detemir', 'Insulin glargine']);
      expect((await resolver.resolve('Insulin detemir')).dbName).toBe('Insulin detemir');
    } finally { env.drugDb.close(); }
  });
});
