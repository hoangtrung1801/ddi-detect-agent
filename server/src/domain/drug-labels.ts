/** FDA prescribing information (openFDA drug label API), used as citable evidence for drug pharmacology. */

export interface DrugLabel {
  /** Database drug name the label was looked up for. */
  drug: string;
  /** Generic name on the label. */
  generic: string;
  setId: string;
  /** DailyMed page of this exact label version family. */
  url: string;
  effectiveTime?: string;
  sections: {
    indications?: string;
    mechanism?: string;
    pharmacokinetics?: string;
    adverseReactions?: string;
    drugInteractions?: string;
    boxedWarning?: string;
  };
}

export interface LabelCache {
  get(key: string): DrugLabel | null | undefined;
  set(key: string, value: DrugLabel | null, ttlMs: number): void;
}

export type LabelFn = (dbName: string) => Promise<DrugLabel | null>;

const TTL_MS = 30 * 24 * 3600 * 1000;
const MISS_TTL_MS = 6 * 3600 * 1000;
const API = 'https://api.fda.gov/drug/label.json';

const clean = (s: string | undefined): string | undefined => {
  const t = s?.replace(/\s+/g, ' ').trim();
  return t || undefined;
};

/** openFDA field values are arrays of section texts. */
const field = (r: Record<string, unknown>, k: string): string | undefined => {
  const v = r[k];
  return Array.isArray(v) ? clean(v.join(' ')) : undefined;
};

export function parseLabel(drug: string, r: Record<string, unknown>): DrugLabel | null {
  const setId = typeof r.set_id === 'string' ? r.set_id : null;
  if (!setId) return null;
  const openfda = (r.openfda ?? {}) as Record<string, unknown>;
  const generic = Array.isArray(openfda.generic_name) ? String(openfda.generic_name[0]) : drug;
  const sections: DrugLabel['sections'] = {};
  const put = (k: keyof DrugLabel['sections'], v: string | undefined) => {
    if (v) sections[k] = v;
  };
  put('indications', field(r, 'indications_and_usage'));
  put('mechanism', field(r, 'mechanism_of_action') ?? field(r, 'clinical_pharmacology'));
  put('pharmacokinetics', field(r, 'pharmacokinetics'));
  put('adverseReactions', field(r, 'adverse_reactions'));
  put('drugInteractions', field(r, 'drug_interactions'));
  put('boxedWarning', field(r, 'boxed_warning'));
  return {
    drug,
    generic,
    setId,
    url: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${encodeURIComponent(setId)}`,
    ...(typeof r.effective_time === 'string' ? { effectiveTime: r.effective_time } : {}),
    sections,
  };
}

export interface LabelOptions {
  cache?: LabelCache;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

/** Latest FDA label for a generic name, preferring labels that have a Mechanism of Action section. Never throws; null when none. */
export async function fetchLabel(dbName: string, opts: LabelOptions = {}): Promise<DrugLabel | null> {
  const key = `v1:${dbName.toLowerCase()}`;
  const cached = opts.cache?.get(key);
  if (cached !== undefined) return cached;
  const fetchFn = opts.fetchFn ?? fetch;
  const name = dbName.replace(/"/g, '');
  const queries = [
    `openfda.generic_name:"${name}" AND _exists_:mechanism_of_action`,
    `openfda.generic_name:"${name}"`,
    `openfda.substance_name:"${name}"`,
  ];
  let transient = false;
  for (const q of queries) {
    try {
      const res = await fetchFn(`${API}?search=${encodeURIComponent(q)}&limit=1`, { signal: AbortSignal.timeout(opts.timeoutMs ?? 8000) });
      if (res.status === 404) continue; // openFDA answers 404 for "no matches"
      if (!res.ok) {
        transient = true;
        continue;
      }
      const body = (await res.json()) as { results?: Record<string, unknown>[] };
      const label = body.results?.[0] ? parseLabel(dbName, body.results[0]) : null;
      if (label) {
        opts.cache?.set(key, label, TTL_MS);
        return label;
      }
    } catch {
      transient = true;
    }
  }
  if (!transient) opts.cache?.set(key, null, MISS_TTL_MS);
  return null;
}

const SENTENCE = /[^.!?]+[.!?]+/g;

/** First `max` characters, cut at a sentence end where possible. */
export function excerpt(text: string | undefined, max: number): string | undefined {
  if (!text) return undefined;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = cut.lastIndexOf('. ');
  return `${end > max * 0.5 ? cut.slice(0, end + 1) : cut}…`;
}

/** Sentences of a section that mention any of the terms (e.g. the partner drug), up to `max` characters. */
export function mentioning(text: string | undefined, terms: string[], max: number): string | undefined {
  if (!text) return undefined;
  const lc = terms.map((t) => t.toLowerCase()).filter((t) => t.length > 2);
  const hits = (text.match(SENTENCE) ?? []).filter((s) => lc.some((t) => s.toLowerCase().includes(t)));
  return hits.length ? excerpt(hits.join(' ').trim(), max) : undefined;
}
