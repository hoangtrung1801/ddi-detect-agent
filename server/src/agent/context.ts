import type { DrugDb, PairRecord } from '../domain/drug-db.ts';
import type { LinkInfo } from '../domain/links.ts';
import { ingredientVariants, type ResolvedDrug, type Resolver } from '../domain/resolver.ts';
import type { PairStatus } from '../domain/risk.ts';
import { normName } from '../util/norm.ts';
import type { InteractionReport } from '../schemas/report.ts';
import type { ProgressSink } from './progress.ts';

/** One requested drug. A product (e.g. a supplement read from a photo) lists its ingredients; a plain drug has none. */
export interface Product {
  name: string;
  ingredients: string[];
}

export interface IngredientPair {
  a: string;
  b: string;
  condition: string;
  firstNamed: string;
  sourceRecords?: PairRecord['sourceRecords'];
  sourceSeverity?: PairRecord['sourceSeverity'];
}

export interface PairResult {
  a: string;
  b: string;
  status: PairStatus;
  condition?: string | undefined;
  firstNamed?: string | undefined;
  sourceRecords?: PairRecord['sourceRecords'];
  sourceSeverity?: PairRecord['sourceSeverity'];
  /** Product pairs only: the ingredient pairs behind an `interaction`. */
  ingredientPairs?: IngredientPair[] | undefined;
  /** Product pairs only: how many ingredient pairs could be looked up, and which ingredients had no database match. */
  checked?: number | undefined;
  unmatched?: string[] | undefined;
}

export interface AgentDeps {
  drugDb: DrugDb;
  resolver: Resolver;
  /** Reference link lookup: Long Châu, then drugs.com (cached, never throws). */
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
  readonly products: Product[];
  /** Resolved ingredients of multi-ingredient products, by normalised input. */
  readonly #members = new Map<string, ResolvedDrug>();

  constructor(deps: AgentDeps, emit: ProgressSink = () => {}, products: Product[] = []) {
    this.deps = deps;
    this.emit = emit;
    this.products = products;
  }

  /** True when at least one requested drug is a multi-ingredient product: pairs are then between products, matched ingredient by ingredient. */
  get grouped(): boolean {
    return this.products.some((p) => p.ingredients.length > 0);
  }

  /** Resolve every ingredient of every product (and plain drugs the model did not resolve). Safe to call repeatedly. */
  async resolveMembers(): Promise<void> {
    await Promise.all(
      this.products.flatMap((p) => {
        if (p.ingredients.length) {
          return p.ingredients
            .filter((n) => !this.#members.has(normName(n)))
            .map(async (n) => {
              this.#members.set(normName(n), await this.#resolveIngredient(n));
            });
        }
        if (this.#byInput.has(normName(p.name))) return [];
        return [
          (async () => {
            this.addResolved(await this.deps.resolver.resolve(p.name));
          })(),
        ];
      }),
    );
  }

  /** Try the substance name hidden in label phrasing first; keep the text as written for display. */
  async #resolveIngredient(n: string): Promise<ResolvedDrug> {
    let raw: ResolvedDrug | undefined;
    for (const v of ingredientVariants(n)) {
      const r = await this.deps.resolver.resolve(v, v);
      if (r.dbName) return { ...r, input: n };
      if (v === n.trim()) raw = r;
    }
    return { ...raw!, input: n };
  }

  /** Distinct resolved entries that make up a product: its ingredients, or the drug itself when it is plain. */
  membersOf(p: Product): ResolvedDrug[] {
    const list = p.ingredients.length
      ? p.ingredients.map((n) => this.#members.get(normName(n)))
      : [this.#byInput.get(normName(p.name))];
    return dedupe(list.filter((r): r is ResolvedDrug => r !== undefined));
  }

  #productDrug(p: Product): ResolvedDrug {
    const members = this.membersOf(p);
    if (!p.ingredients.length) {
      return members[0] ?? { input: p.name, generic: p.name, dbName: null, confidence: 0, method: 'none', alternatives: [] };
    }
    const matched = members.filter((m) => m.dbName).length;
    return {
      input: p.name,
      generic: p.name,
      dbName: matched ? p.name : null,
      confidence: members.length ? Math.round((matched / members.length) * 100) / 100 : 0,
      method: matched ? 'exact' : 'none',
      alternatives: [],
      ingredients: members,
    };
  }

  addResolved(r: ResolvedDrug): void {
    this.#byInput.set(normName(r.input), r);
  }

  /** Distinct drugs: resolved ones deduplicated by DB name, unresolved ones kept per input. */
  get drugs(): ResolvedDrug[] {
    if (this.grouped) return this.products.map((p) => this.#productDrug(p));
    return dedupe([...this.#byInput.values()]);
  }
}

function dedupe(list: ResolvedDrug[]): ResolvedDrug[] {
  const seen = new Set<string>();
  const out: ResolvedDrug[] = [];
  for (const r of list) {
    const key = r.dbName ? `db:${normName(r.dbName)}` : `in:${normName(r.input)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export function drugLabel(r: ResolvedDrug): string {
  return r.dbName ?? r.input;
}

/** Every unique pair among the run's drugs. Unresolved drugs yield `unresolved`; lookups are pure DB reads. */
export function computePairs(ctx: RunContext): PairResult[] {
  if (ctx.grouped) return computeProductPairs(ctx);
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
          ? { a, b, status: 'interaction', ...rec }
          : { a, b, status: 'no_record' },
      );
    }
  }
  return out;
}

/**
 * Pairs between requested drugs when some are multi-ingredient products. Ingredients of the same product are never
 * compared with each other. A product pair is an `interaction` when any ingredient pair is recorded, `no_record` when
 * at least one ingredient pair could be looked up and none is recorded, and `unresolved` when nothing could be looked up.
 */
function computeProductPairs(ctx: RunContext): PairResult[] {
  const drugs = ctx.drugs;
  const out: PairResult[] = [];
  for (let i = 0; i < ctx.products.length; i++) {
    for (let j = i + 1; j < ctx.products.length; j++) {
      const pa = ctx.products[i]!;
      const pb = ctx.products[j]!;
      const a = drugLabel(drugs[i]!);
      const b = drugLabel(drugs[j]!);
      const ma = ctx.membersOf(pa);
      const mb = ctx.membersOf(pb);
      const found: IngredientPair[] = [];
      let checked = 0;
      for (const x of ma) {
        for (const y of mb) {
          if (!x.dbName || !y.dbName || normName(x.dbName) === normName(y.dbName)) continue;
          checked++;
          const rec = ctx.deps.drugDb.lookupPair(ctx.deps.drugDb.getDrug(x.dbName)!, ctx.deps.drugDb.getDrug(y.dbName)!);
          if (rec) found.push({ a: x.dbName, b: y.dbName, ...rec });
        }
      }
      const plain = !pa.ingredients.length && !pb.ingredients.length;
      const detail = plain
        ? {}
        : { checked, unmatched: [...ma, ...mb].filter((m) => !m.dbName).map((m) => m.input) };
      if (found.length) {
        out.push({
          a,
          b,
          status: 'interaction',
          condition: plain ? found[0]!.condition : found.map((f) => `${f.a} + ${f.b}: ${f.condition}`).join('\n'),
          firstNamed: found[0]!.firstNamed,
          ...(found.some((f) => f.sourceRecords?.length) ? {
            sourceRecords: found.flatMap((f) => f.sourceRecords ?? []),
            sourceSeverity: found.some((f) => f.sourceSeverity === 'major') ? 'major'
              : found.some((f) => f.sourceRecords?.some((r) => r.level === 'Unknown')) ? undefined
              : found.some((f) => f.sourceSeverity === 'moderate') ? 'moderate'
              : found.some((f) => f.sourceSeverity === 'minor') ? 'minor' : undefined,
          } : {}),
          ...(plain ? {} : { ingredientPairs: found }),
          ...detail,
        });
      } else {
        out.push({ a, b, status: checked > 0 ? 'no_record' : 'unresolved', ...detail });
      }
    }
  }
  return out;
}
