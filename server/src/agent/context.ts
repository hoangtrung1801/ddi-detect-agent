import type { DrugDb } from '../domain/drug-db.ts';
import type { LinkInfo } from '../domain/links.ts';
import type { ResolvedDrug, Resolver } from '../domain/resolver.ts';
import type { PairStatus } from '../domain/risk.ts';
import { normName } from '../util/norm.ts';
import type { InteractionReport } from '../schemas/report.ts';
import type { ProgressSink } from './progress.ts';

export interface PairResult {
  a: string;
  b: string;
  status: PairStatus;
  condition?: string | undefined;
  firstNamed?: string | undefined;
}

export interface AgentDeps {
  drugDb: DrugDb;
  resolver: Resolver;
  /** drugs.com link lookup (cached, never throws). */
  linkFn: (dbName: string) => Promise<LinkInfo>;
}

/** Per-request state shared by the tools and the guard. Never shared across requests. */
export class RunContext {
  readonly deps: AgentDeps;
  readonly emit: ProgressSink;
  readonly #byInput = new Map<string, ResolvedDrug>();
  pairs: PairResult[] | null = null;
  links: Record<string, LinkInfo> = {};
  /** Set by submit_report once the merged report passed validation. */
  report: InteractionReport | undefined;

  constructor(deps: AgentDeps, emit: ProgressSink = () => {}) {
    this.deps = deps;
    this.emit = emit;
  }

  addResolved(r: ResolvedDrug): void {
    this.#byInput.set(normName(r.input), r);
  }

  /** Distinct drugs: resolved ones deduplicated by DB name, unresolved ones kept per input. */
  get drugs(): ResolvedDrug[] {
    const seen = new Set<string>();
    const out: ResolvedDrug[] = [];
    for (const r of this.#byInput.values()) {
      const key = r.dbName ? `db:${normName(r.dbName)}` : `in:${normName(r.input)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
    return out;
  }
}

export function drugLabel(r: ResolvedDrug): string {
  return r.dbName ?? r.input;
}

/** Every unique pair among the run's drugs. Unresolved drugs yield `unresolved`; lookups are pure DB reads. */
export function computePairs(ctx: RunContext): PairResult[] {
  const drugs = ctx.drugs;
  const out: PairResult[] = [];
  for (let i = 0; i < drugs.length; i++) {
    for (let j = i + 1; j < drugs.length; j++) {
      const x = drugs[i]!;
      const y = drugs[j]!;
      const a = drugLabel(x);
      const b = drugLabel(y);
      if (!x.dbName || !y.dbName) {
        out.push({ a, b, status: 'unresolved' });
        continue;
      }
      const dx = ctx.deps.drugDb.getDrug(x.dbName)!;
      const dy = ctx.deps.drugDb.getDrug(y.dbName)!;
      const rec = ctx.deps.drugDb.lookupPair(dx, dy);
      out.push(
        rec
          ? { a, b, status: 'interaction', condition: rec.condition, firstNamed: rec.firstNamed }
          : { a, b, status: 'no_record' },
      );
    }
  }
  return out;
}
