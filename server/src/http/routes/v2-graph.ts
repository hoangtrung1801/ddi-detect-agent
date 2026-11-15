import { Hono } from 'hono';
import type { Drug } from '../../domain/drug-db.ts';
import type { InteractionDetail } from '../../domain/ddinter-details.ts';
import type { AppServices } from '../services.ts';
import { HttpError } from '../util.ts';

const MAX_SEEDS = 10;
const MAX_NODES = 200;

export interface GraphNode {
  id: string;
  degree: number;
  /** True for the drugs the caller asked about (or the hubs, with no drugs given). */
  seed: boolean;
}

export type GraphSeverity = 'major' | 'moderate' | 'minor' | 'unknown';

export interface GraphLink {
  /** The drug DDInter names first; the order says nothing about which drug acts on which. */
  source: string;
  target: string;
  severity: GraphSeverity;
}

/** Bare DDInter export rows carry this template instead of a description. */
const TEMPLATE = /^DDInter 2\.0 risk level: \w+\. The downloadable source does not provide/;

function intParam(v: string | undefined, def: number, min: number, max: number): number {
  const n = v === undefined ? def : Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}

/** Interaction-graph views of the database, for the 3D graph page. */
export function v2GraphRoutes(s: AppServices): Hono {
  const r = new Hono();

  r.get('/drugs/search', (c) => {
    const q = c.req.query('q') ?? '';
    const limit = intParam(c.req.query('limit'), 10, 1, 50);
    return c.json({ results: s.drugDb.search(q, limit).map((d) => ({ name: d.name, degree: s.drugDb.degree(d) })) });
  });

  // ?drugs=a,b&neighbors=N: the named drugs plus up to N most-connected partners each, and every
  // interaction among them. With no drugs, the most-connected drugs in the database (?hubs=N).
  r.get('/graph', async (c) => {
    const inputs = (c.req.query('drugs') ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (inputs.length > MAX_SEEDS) throw new HttpError(400, 'VALIDATION', `At most ${MAX_SEEDS} drugs`);
    const neighbors = intParam(c.req.query('neighbors'), 25, 0, 100);

    const seeds = new Map<number, Drug>();
    const resolved: { input: string; name: string }[] = [];
    const unresolved: string[] = [];
    for (const input of inputs) {
      const res = await s.resolver.resolve(input);
      const d = res.dbName ? s.drugDb.getDrug(res.dbName) : undefined;
      if (!d) {
        unresolved.push(input);
        continue;
      }
      resolved.push({ input, name: d.name });
      seeds.set(d.id, d);
    }
    if (!inputs.length) for (const d of s.drugDb.hubs(intParam(c.req.query('hubs'), 40, 2, 100))) seeds.set(d.id, d);

    // Neighbours are added seed by seed until the node cap; count the ones that did not fit.
    const all = new Map(seeds);
    const dropped = new Set<number>();
    for (const seed of seeds.values()) {
      for (const d of s.drugDb.neighbors(seed, inputs.length ? neighbors : 0)) {
        if (all.has(d.id)) continue;
        if (all.size >= MAX_NODES) dropped.add(d.id);
        else all.set(d.id, d);
      }
    }

    const list = [...all.values()];
    const links: GraphLink[] = s.drugDb
      .edgesAmong(list)
      .map((e) => ({ source: e.first.name, target: e.second.name, severity: e.severity ?? 'unknown' }));
    const nodes: GraphNode[] = list.map((d) => ({ id: d.name, degree: s.drugDb.degree(d), seed: seeds.has(d.id) }));
    const truncated = dropped.size ? { maxNodes: MAX_NODES, omitted: dropped.size } : null;
    return c.json({ nodes, links, resolved, unresolved, truncated });
  });

  // ?a=&b=: what DDInter says about one pair (graph node names), fetched when an edge is opened.
  r.get('/graph/pair', (c) => {
    const a = s.drugDb.getDrug(c.req.query('a') ?? '');
    const b = s.drugDb.getDrug(c.req.query('b') ?? '');
    if (!a || !b) throw new HttpError(404, 'NOT_FOUND', 'Unknown drug');
    const rec = s.drugDb.lookupPair(a, b);
    if (!rec) throw new HttpError(404, 'NOT_FOUND', 'No interaction recorded for this pair');
    const details: InteractionDetail[] = (rec.sourceRecords ?? []).flatMap((r) => r.details ?? []);
    const uniq = (xs: (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))];
    const conditions = rec.condition.split('\n').filter((x) => x && !TEMPLATE.test(x));
    return c.json({
      a: a.name,
      b: b.name,
      severity: (rec.sourceSeverity ?? 'unknown') as GraphSeverity,
      descriptions: uniq([...details.map((d) => d.description), ...conditions]),
      management: uniq(details.map((d) => d.management)),
      mechanisms: uniq(details.flatMap((d) => d.mechanisms)),
      urls: uniq([...details.map((d) => d.url), ...(rec.sourceRecords ?? []).map((r) => r.url)]),
    });
  });

  return r;
}
