import type { AgentTool, BeforeToolCallContext, BeforeToolCallResult } from '@earendil-works/pi-agent-core';
import { Value } from 'typebox/value';
import { overallRisk, type PairStatus, type Severity } from '../domain/risk.ts';
import {
  InteractionReportSchema,
  DISCLAIMER_VI,
  type DrugProfile,
  type EvidenceSource,
  type InteractionReport,
  type PairAnalysis,
  type ReportDraft,
  type ReportPair,
} from '../schemas/report.ts';
import { normName, pairKey } from '../util/norm.ts';
import { drugLabel, type PairResult, type RunContext } from './context.ts';
import { collectLinks } from './tools/drug-links.ts';

const SAFE_CLAIM = /an toàn|không (có )?tương tác|không gây tương tác|không có nguy cơ|safe/i;

function fixedExplanation(p: PairResult): string {
  // Product pairs: say how much of the product could actually be checked.
  const scope =
    p.checked === undefined
      ? ''
      : ` Đã tra cứu ${p.checked} cặp thành phần${p.unmatched?.length ? `; chưa tra cứu được: ${p.unmatched.join(', ')}` : ''}.`;
  if (p.status === 'unresolved') {
    return `Không xác định: ít nhất một trong hai thuốc (${p.a}, ${p.b}) không khớp được với cơ sở dữ liệu nên chưa kiểm tra được cặp này.${scope} Hãy kiểm tra lại tên thuốc hoặc hỏi dược sĩ.`;
  }
  return `Không có dữ liệu: cơ sở dữ liệu không ghi nhận tương tác giữa ${p.a} và ${p.b}.${scope} Điều này không đồng nghĩa với an toàn; hãy hỏi bác sĩ hoặc dược sĩ.`;
}

/** Keeps only citations of sources registered in this run; an item that cites nothing valid is dropped. */
class Citations {
  readonly #known: Map<string, EvidenceSource>;
  constructor(known: Map<string, EvidenceSource>) {
    this.#known = known;
  }
  ids(list: string[]): string[] {
    return [...new Set(list.map((s) => s.trim().replace(/^\[|\]$/g, '').toUpperCase()))].filter((id) => this.#known.has(id));
  }
  item<T extends { text: string; sources: string[] }>(x: T | undefined): T | undefined {
    if (!x) return undefined;
    const text = x.text.trim();
    const sources = this.ids(x.sources);
    return text && sources.length ? { ...x, text, sources } : undefined;
  }
  list<T extends { text: string; sources: string[] }>(l: T[]): T[] {
    return l.map((x) => this.item(x)).filter((x): x is T => x !== undefined);
  }
}

function cleanAnalysis(a: PairAnalysis, c: Citations, hasManagement: boolean): PairAnalysis | undefined {
  const why = a.why_harmful.trim();
  const whySources = c.ids(a.why_harmful_sources);
  if (!why || !whySources.length) return undefined; // an unsourced explanation is not shown at all
  const chain = a.chain
    .map((s) => ({ actor: s.actor.trim(), effect: s.effect.trim(), sources: c.ids(s.sources) }))
    .filter((s) => s.actor && s.effect && s.sources.length);
  const onset = c.item(a.onset);
  const management = hasManagement ? a.management_vi?.trim() : undefined;
  return {
    mechanism_type: a.mechanism_type,
    why_harmful: why,
    why_harmful_sources: whySources,
    chain: chain.length >= 2 ? chain : [],
    consequences: c.list(a.consequences),
    risk_factors: c.list(a.risk_factors),
    monitoring: c.list(a.monitoring),
    ...(onset ? { onset } : {}),
    ...(management ? { management_vi: management } : {}),
  };
}

function cleanProfile(p: DrugProfile, name: string, c: Citations): DrugProfile | undefined {
  const mechanism = c.item(p.mechanism);
  const role = c.item(p.interaction_role);
  if (!mechanism || !role) return undefined;
  const pk = c.item(p.pharmacokinetics);
  return {
    name,
    drug_class: p.drug_class.trim(),
    mechanism,
    indications: c.list(p.indications),
    ...(pk ? { pharmacokinetics: pk } : {}),
    adverse_effects: c.list(p.adverse_effects),
    interaction_role: role,
  };
}

/** Every source id cited anywhere in a value. */
function citedIds(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => citedIds(x, out));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      if ((k === 'sources' || k === 'why_harmful_sources') && Array.isArray(x)) x.forEach((id) => out.add(String(id)));
      else citedIds(x, out);
    }
  }
  return out;
}

/** Blocks submit_report until check_interactions has produced pair results for this request. */
export function makeBeforeToolCall(ctx: RunContext) {
  return async (c: BeforeToolCallContext): Promise<BeforeToolCallResult | undefined> => {
    if (c.toolCall.name === 'submit_report' && !ctx.pairs) {
      return {
        block: true,
        reason: 'submit_report is not allowed before check_interactions has run. Call resolve_drugs, then check_interactions, then submit_report.',
      };
    }
    return undefined;
  };
}

/** Merge the model's text with the recorded database results. Statuses, conditions, risk and drugs come from code. */
export async function buildReport(draft: ReportDraft, ctx: RunContext): Promise<InteractionReport> {
  if (!ctx.pairs) throw new Error('check_interactions has not run');
  const drugs = ctx.drugs;

  // Map any spelling the model might use for a drug to the label used in pairs.
  const labelOf = new Map<string, string>();
  for (const d of drugs) {
    const label = drugLabel(d);
    for (const s of [d.input, d.generic, d.dbName, label]) if (s) labelOf.set(normName(s), label);
  }
  const draftBy = new Map<string, ReportDraft['pairs'][number]>();
  for (const p of draft.pairs) {
    const la = labelOf.get(normName(p.a));
    const lb = labelOf.get(normName(p.b));
    if (la && lb && la !== lb) draftBy.set(pairKey(la, lb), p); // pairs that do not exist are dropped
  }

  const cite = new Citations(ctx.sources);
  const pairs: ReportPair[] = ctx.pairs.map((r) => {
    const d = draftBy.get(pairKey(r.a, r.b));
    const base = { a: r.a, b: r.b, status: r.status as PairStatus };
    if (r.status === 'interaction') {
      const out: ReportPair = {
        ...base,
        db_condition: r.condition ?? '',
        ...(r.sourceRecords?.length ? { source_records: r.sourceRecords, severity_source: 'DDInter 2.0' as const } : {}),
        ...(r.ingredientPairs?.length ? { ingredient_pairs: r.ingredientPairs.map(({ a, b, condition }) => ({ a, b, condition })) } : {}),
        explanation: d?.explanation?.trim() || `Cơ sở dữ liệu ghi nhận: ${r.condition}`,
      };
      const hasManagement = (r.sourceRecords ?? []).some((x) => x.details?.some((dd) => dd.management));
      const analysis = d?.analysis ? cleanAnalysis(d.analysis, cite, hasManagement) : undefined;
      if (analysis) out.analysis = analysis;
      if (r.sourceRecords?.length) {
        if (r.sourceSeverity) out.severity = r.sourceSeverity;
      } else if (d?.severity) {
        out.severity = d.severity as Severity;
        out.severity_source = 'model';
      }
      return out;
    }
    let explanation = fixedExplanation(r);
    const extra = d?.explanation?.trim();
    if (extra && !SAFE_CLAIM.test(extra)) {
      explanation += ` Ghi chú (kiến thức dược lý chung, không phải từ cơ sở dữ liệu): ${extra}`;
    }
    return { ...base, explanation };
  });

  // Products have no database page of their own: link their interacting ingredients instead.
  const resolvedNames = ctx.grouped
    ? [
        ...new Set([
          ...drugs.filter((d) => !d.ingredients && d.dbName).map((d) => d.dbName!),
          ...ctx.pairs.flatMap((p) => (p.ingredientPairs ?? []).flatMap((i) => [i.a, i.b])),
        ]),
      ]
    : drugs.filter((d) => d.dbName).map((d) => d.dbName!);
  await collectLinks(ctx, resolvedNames);
  const links: InteractionReport['links'] = {};
  for (const n of resolvedNames) if (ctx.links[n]) links[n] = ctx.links[n]!;

  // Profiles only for active ingredients that take part in a recorded interaction, keyed by their database name.
  const involved = new Map<string, string>();
  for (const p of ctx.pairs) {
    if (p.status !== 'interaction') continue;
    for (const n of p.ingredientPairs ? p.ingredientPairs.flatMap((i) => [i.a, i.b]) : [p.a, p.b]) involved.set(normName(n), n);
  }
  const drugProfiles: Record<string, DrugProfile> = {};
  for (const prof of draft.drug_profiles ?? []) {
    const key = normName(labelOf.get(normName(prof.name)) ?? ctx.deps.drugDb.getDrug(prof.name)?.name ?? prof.name);
    const name = involved.get(key);
    const clean = name && !drugProfiles[name] ? cleanProfile(prof, name, cite) : undefined;
    if (name && clean) drugProfiles[name] = clean;
  }
  // Cited sources, plus the DDInter pages behind every interaction (shown as the pair's source data).
  const used = citedIds([pairs, drugProfiles]);
  for (const s of ctx.sources.values()) if (s.kind === 'ddinter') used.add(s.id);
  const sources = Object.fromEntries([...ctx.sources.values()].filter((s) => used.has(s.id)).map((s) => [s.id, s]));

  const report: InteractionReport = {
    title: draft.title.trim() || 'Kết quả kiểm tra tương tác thuốc',
    drugs,
    pairs,
    overall_risk: overallRisk(pairs),
    recommendations: draft.recommendations.map((s) => s.trim()).filter(Boolean),
    links,
    ...(Object.keys(drugProfiles).length ? { drug_profiles: drugProfiles } : {}),
    ...(Object.keys(sources).length ? { sources } : {}),
    disclaimer: DISCLAIMER_VI,
  };
  if (!Value.Check(InteractionReportSchema, report)) {
    const errs = [...Value.Errors(InteractionReportSchema, report)].map((e) => `${e.instancePath}: ${e.message}`);
    throw new Error(`Report failed validation: ${errs.join('; ')}`);
  }
  return report;
}

export type AnyTool = AgentTool<any>;
