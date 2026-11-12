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
    warnings?: string;
    /** Patient counselling text or Medication Guide: plain-language warning signs. */
    patientInfo?: string;
    geriatric?: string;
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
  put('warnings', field(r, 'warnings_and_cautions') ?? field(r, 'warnings'));
  put('patientInfo', field(r, 'information_for_patients') ?? field(r, 'spl_medguide'));
  put('geriatric', field(r, 'geriatric_use'));
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
  apiKey?: string;
}

/** Generic names of a label: several for a combination product ("HYDROCODONE BITARTRATE AND ACETAMINOPHEN"). */
function ingredientCount(r: Record<string, unknown>): number {
  const openfda = (r.openfda ?? {}) as Record<string, unknown>;
  const subst = Array.isArray(openfda.substance_name) ? openfda.substance_name.length : 0;
  const generic = Array.isArray(openfda.generic_name) ? String(openfda.generic_name[0]) : '';
  return Math.max(subst, generic.split(/\s+AND\s+|,\s*/i).filter(Boolean).length, 1);
}

/** The first single-ingredient label among the results, else the first label. */
export function bestLabel(drug: string, name: string, results: Record<string, unknown>[]): (DrugLabel & { single: boolean }) | null {
  const generic = (r: Record<string, unknown>) => String(((r.openfda ?? {}) as Record<string, unknown[]>).generic_name?.[0] ?? '').toLowerCase();
  const single = results.find((r) => ingredientCount(r) === 1 && generic(r).includes(name.toLowerCase()));
  const pick = single ?? results[0];
  const label = pick ? parseLabel(drug, pick) : null;
  return label ? { ...label, single: !!single } : null;
}

/** International (INN/BAN) names whose US label uses a different generic name. */
const US_NAMES: Record<string, string> = {
  'acetylsalicylic acid': 'aspirin',
  paracetamol: 'acetaminophen',
  salbutamol: 'albuterol',
  levosalbutamol: 'levalbuterol',
  glibenclamide: 'glyburide',
  adrenaline: 'epinephrine',
  noradrenaline: 'norepinephrine',
  frusemide: 'furosemide',
  lignocaine: 'lidocaine',
  pethidine: 'meperidine',
  ciclosporin: 'cyclosporine',
  rifampicin: 'rifampin',
  colecalciferol: 'cholecalciferol',
  thyroxine: 'levothyroxine',
  dicycloverine: 'dicyclomine',
  hyoscine: 'scopolamine',
  orciprenaline: 'metaproterenol',
};

/** Latest FDA label for a generic name, preferring labels that have a Mechanism of Action section. Never throws; null when none. */
export async function fetchLabel(dbName: string, opts: LabelOptions = {}): Promise<DrugLabel | null> {
  const key = `v3:${dbName.toLowerCase()}`;
  const cached = opts.cache?.get(key);
  if (cached !== undefined) return cached;
  const fetchFn = opts.fetchFn ?? fetch;
  const name = (US_NAMES[dbName.toLowerCase()] ?? dbName).replace(/"/g, '');
  // Most specific first; all run at once because openFDA can take several seconds per query.
  const queries = [
    `openfda.generic_name:"${name}" AND _exists_:mechanism_of_action`,
    `openfda.generic_name:"${name}"`,
    `openfda.substance_name:"${name}"`,
  ];
  let transient = false;
  const results = await Promise.all(
    queries.map(async (q) => {
      try {
        const key = opts.apiKey ? `&api_key=${encodeURIComponent(opts.apiKey)}` : '';
        // openFDA sometimes takes 10+ s to answer, so the timeout is generous; results are cached for 30 days.
        const res = await fetchFn(`${API}?search=${encodeURIComponent(q)}&limit=10${key}`, { signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000) });
        if (res.status === 404) return null; // openFDA answers 404 for "no matches"
        if (!res.ok) {
          transient = true;
          return null;
        }
        const body = (await res.json()) as { results?: Record<string, unknown>[] };
        return bestLabel(dbName, name, body.results ?? []);
      } catch {
        transient = true;
        return null;
      }
    }),
  );
  // A single-ingredient label beats a combination product (e.g. hydrocodone + acetaminophen), whatever query found it.
  const best = results.find((l) => l?.single) ?? results.find((l) => l !== null) ?? null;
  const label: DrugLabel | null = best ? (({ single: _, ...rest }) => rest)(best) : null;
  if (label) opts.cache?.set(key, label, TTL_MS);
  else if (!transient) opts.cache?.set(key, null, MISS_TTL_MS);
  return label;
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
