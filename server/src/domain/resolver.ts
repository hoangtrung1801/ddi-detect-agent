import { normName } from '../util/norm.ts';
import type { DrugDb } from './drug-db.ts';
import type { Embedder } from './embedder.ts';
import { buildAliasMap } from './aliases.ts';

export type ResolveMethod = 'exact' | 'alias' | 'vector' | 'none';

export interface Alternative {
  name: string;
  score: number;
}

export interface ResolvedDrug {
  input: string;
  generic: string;
  dbName: string | null;
  confidence: number;
  method: ResolveMethod;
  alternatives: Alternative[];
  /** Only on a multi-ingredient product: how each of its ingredients resolved. */
  ingredients?: ResolvedDrug[];
}

export interface VectorIndex {
  names: string[];
  /** Row-major, L2-normalised, names.length x dim. */
  matrix: Float32Array;
  dim: number;
}

export interface ResolverOptions {
  drugDb: DrugDb;
  vectors: VectorIndex | null;
  embedder: Embedder | null;
  /** Below this cosine score a vector match is not accepted. */
  resolveMin?: number;
  aliases?: Map<string, string>;
}

const DOSE_RE = /\b\d+([.,]\d+)?\s*(mg|mcg|µg|ug|g|ml|iu|ui|%|mmol|meq)(\s*\/\s*\d+([.,]\d+)?\s*(mg|ml|g))?\b/gi;

/** Strip dose strings, bracketed text and punctuation: "Paracetamol 500mg (Panadol)" -> "paracetamol". */
export function cleanName(s: string): string {
  return normName(
    s
      .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
      .replace(DOSE_RE, ' ')
      .replace(/\b(tablets?|capsules?|viên|nén|hộp|syrup|sirô|injection)\b/gi, ' ')
      .replace(/[^\p{L}\p{N}\s\-+]/gu, ' '),
  );
}

/**
 * Candidate substance names for an ingredient written the way labels write it, most specific first, raw text last:
 * "Calcium (from calcium carbonate)" -> ["calcium carbonate", "Calcium", raw]; "Ibuprofen from corn starch" -> ["Ibuprofen", raw].
 */
export function ingredientVariants(raw: string): string[] {
  const text = raw.trim();
  const out: string[] = [];
  const source = /\(\s*(?:from|as|derived from|source:?)\s+([^)]+)\)/i.exec(text)?.[1];
  if (source) out.push(source.trim());
  const withoutParens = text.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const withoutSource = withoutParens.replace(/\s+(?:from|derived from|as)\s+.*$/i, '').trim();
  out.push(withoutSource, withoutParens, text);
  const seen = new Set<string>();
  return out.filter((v) => v && !seen.has(v.toLowerCase()) && seen.add(v.toLowerCase()));
}

export class Resolver {
  readonly #db: DrugDb;
  readonly #vectors: VectorIndex | null;
  readonly #embedder: Embedder | null;
  readonly #min: number;
  readonly #aliases: Map<string, string>;
  readonly #cache = new Map<string, ResolvedDrug>();

  constructor(opts: ResolverOptions) {
    this.#db = opts.drugDb;
    this.#vectors = opts.vectors;
    this.#embedder = opts.embedder;
    this.#min = opts.resolveMin ?? 0.8;
    this.#aliases = opts.aliases ?? buildAliasMap();
  }

  /** order: exact(input) -> exact(guess) -> alias table -> vector top-3 on guess ?? input. */
  async resolve(input: string, genericGuess?: string): Promise<ResolvedDrug> {
    const rawInput = input.trim();
    const guess = genericGuess?.trim() || undefined;
    const cacheKey = `${normName(rawInput)}|${guess ? normName(guess) : ''}`;
    const hit = this.#cache.get(cacheKey);
    if (hit) return structuredClone(hit);
    const r = await this.#resolve(rawInput, guess);
    this.#cache.set(cacheKey, r);
    return structuredClone(r);
  }

  async #resolve(input: string, guess: string | undefined): Promise<ResolvedDrug> {
    const generic = guess ?? input;
    const done = (dbName: string, confidence: number, method: ResolveMethod): ResolvedDrug => ({
      input,
      generic,
      dbName,
      confidence,
      method,
      alternatives: [],
    });
    const candidates = [input, guess, cleanName(input), guess ? cleanName(guess) : undefined].filter(
      (x): x is string => !!x && x.length > 0,
    );
    for (const c of candidates) {
      const d = this.#db.getDrug(c);
      if (d) return done(d.name, 1, 'exact');
    }
    for (const c of candidates) {
      const target = this.#aliases.get(normName(c));
      if (target) {
        const d = this.#db.getDrug(target);
        if (d) return done(d.name, 0.95, 'alias');
      }
    }
    if (!this.#vectors || !this.#embedder) {
      return { input, generic, dbName: null, confidence: 0, method: 'none', alternatives: [] };
    }
    const query = cleanName(guess ?? input) || normName(guess ?? input);
    const [qv] = await this.#embedder.embed([query]);
    const top = qv ? this.#topK(qv, 3) : [];
    const best = top[0];
    // A broad substance/class must not silently become a more-specific form in the expanded catalog.
    // Exact names and explicit aliases above remain authoritative; keep candidates for clarification.
    const narrowsInput = best ? cleanName(best.name).startsWith(`${query} `) : false;
    if (best && best.score >= this.#min && !narrowsInput) {
      return {
        input,
        generic,
        dbName: best.name,
        confidence: round(best.score),
        method: 'vector',
        alternatives: top.slice(1).map((t) => ({ name: t.name, score: round(t.score) })),
      };
    }
    return {
      input,
      generic,
      dbName: null,
      confidence: best ? round(best.score) : 0,
      method: 'none',
      alternatives: top.map((t) => ({ name: t.name, score: round(t.score) })),
    };
  }

  #topK(q: Float32Array, k: number): Alternative[] {
    const { names, matrix, dim } = this.#vectors!;
    const best: Alternative[] = [];
    for (let i = 0; i < names.length; i++) {
      let s = 0;
      const o = i * dim;
      for (let j = 0; j < dim; j++) s += q[j]! * matrix[o + j]!;
      if (best.length < k || s > best[best.length - 1]!.score) {
        best.push({ name: names[i]!, score: s });
        best.sort((x, y) => y.score - x.score);
        if (best.length > k) best.pop();
      }
    }
    return best;
  }
}

function round(x: number): number {
  return Math.round(x * 10000) / 10000;
}
