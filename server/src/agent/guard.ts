import type { AgentTool, BeforeToolCallContext, BeforeToolCallResult } from '@earendil-works/pi-agent-core';
import { Value } from 'typebox/value';
import { overallRisk, type PairStatus, type Severity } from '../domain/risk.ts';
import { InteractionReportSchema, DISCLAIMER_VI, type InteractionReport, type ReportDraft, type ReportPair } from '../schemas/report.ts';
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

  const report: InteractionReport = {
    title: draft.title.trim() || 'Kết quả kiểm tra tương tác thuốc',
    drugs,
    pairs,
    overall_risk: overallRisk(pairs),
    recommendations: draft.recommendations.map((s) => s.trim()).filter(Boolean),
    links,
    disclaimer: DISCLAIMER_VI,
  };
  if (!Value.Check(InteractionReportSchema, report)) {
    const errs = [...Value.Errors(InteractionReportSchema, report)].map((e) => `${e.instancePath}: ${e.message}`);
    throw new Error(`Report failed validation: ${errs.join('; ')}`);
  }
  return report;
}

export type AnyTool = AgentTool<any>;
