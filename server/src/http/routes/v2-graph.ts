import { Hono } from 'hono';
import type { Drug } from '../../domain/drug-db.ts';
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

export interface GraphLink {
  source: string;
  target: string;
  condition: string;
}

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

    const all = new Map(seeds);
    for (const seed of seeds.values()) {
      for (const d of s.drugDb.neighbors(seed, inputs.length ? neighbors : 0)) {
        if (all.size >= MAX_NODES) break;
        all.set(d.id, d);
      }
    }

    const list = [...all.values()];
    const links: GraphLink[] = [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const rec = s.drugDb.lookupPair(list[i]!, list[j]!);
        if (!rec) continue;
        const [source, target] = rec.firstNamed === list[i]!.name ? [list[i]!, list[j]!] : [list[j]!, list[i]!];
        links.push({ source: source.name, target: target.name, condition: rec.condition });
      }
    }
    const nodes: GraphNode[] = list.map((d) => ({ id: d.name, degree: s.drugDb.degree(d), seed: seeds.has(d.id) }));
    return c.json({ nodes, links, resolved, unresolved });
  });

  return r;
}
