import type { ParsedResult, QueryResponse } from '../../schemas/api.ts';
import type { InteractionReport, ReportPair } from '../../schemas/report.ts';

export const STATUS_VI = {
  interaction: 'Có Tương Tác',
  no_record: 'Không có dữ liệu',
  unresolved: 'Không xác định',
} as const;

const RISK_VI: Record<InteractionReport['overall_risk'], string> = {
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp',
  none: 'Không có',
  unknown: 'Không xác định',
};
const SEVERITY_VI = { major: 'nghiêm trọng', moderate: 'trung bình', minor: 'nhẹ' } as const;
const SEVERITY_RANK = { major: 0, moderate: 1, minor: 2 } as const;

function details(p: ReportPair): string {
  return p.status === 'interaction' && p.db_condition ? `${p.explanation} (Nguồn CSDL: ${p.db_condition})` : p.explanation;
}

function cell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

export function reportToMarkdown(r: InteractionReport): string {
  const out: string[] = [`## ${r.title}`, ''];
  out.push('### Chuyển Đổi Tên Thuốc', '', '| Tên Gốc | Tên Đã Chuyển Đổi |', '| --- | --- |');
  for (const d of r.drugs) out.push(`| ${cell(d.input)} | ${cell(d.dbName ?? 'Không xác định')} |`);
  out.push('', '### Tương Tác Giữa Các Cặp Thuốc', '', '| Thuốc 1 | Thuốc 2 | Trạng Thái | Chi Tiết |', '| --- | --- | --- | --- |');
  for (const p of r.pairs) out.push(`| ${cell(p.a)} | ${cell(p.b)} | ${STATUS_VI[p.status]} | ${cell(details(p))} |`);
  out.push('', '### Tóm Tắt Cuối Cùng', '', `**Rủi Ro Tổng Thể:** ${RISK_VI[r.overall_risk]}`);
  const main = interactionLines(r);
  if (main.length) out.push('', '**Các Tương Tác Chính:**', ...main.map((l) => `- ${l}`));
  if (r.recommendations.length) out.push('', '**Khuyến Nghị Lâm Sàng:**', ...r.recommendations.map((l) => `- ${l}`));
  out.push('', `> ${r.disclaimer}`);
  return out.join('\n');
}

function interactionLines(r: InteractionReport): string[] {
  return r.pairs
    .filter((p) => p.status === 'interaction')
    .sort((x, y) => (x.severity ? SEVERITY_RANK[x.severity] : 1) - (y.severity ? SEVERITY_RANK[y.severity] : 1))
    .map((p) => `${p.a} + ${p.b}${p.severity ? ` (mức độ: ${SEVERITY_VI[p.severity]})` : ''}`);
}

export function reportToParsedResult(r: InteractionReport): ParsedResult {
  const ref = (name: string) => {
    const l = r.links[name];
    return l ? { name, link: l.url } : null;
  };
  return {
    step: 1,
    title: r.title,
    drug_conversion: r.drugs.map((d) => ({
      original: d.input,
      converted: d.dbName ?? 'Không xác định',
      reference: d.dbName ? ref(d.dbName) : null,
    })),
    interactions: r.pairs.map((p) => ({
      drug1: p.a,
      drug2: p.b,
      status: STATUS_VI[p.status],
      details: details(p),
      reference1: ref(p.a),
      reference2: ref(p.b),
    })),
    summary: {
      overall_risk: RISK_VI[r.overall_risk],
      major_interactions: interactionLines(r),
      recommendations: r.recommendations,
    },
  };
}

export function reportToQueryResponse(r: InteractionReport): QueryResponse {
  const drug_links: Record<string, string> = {};
  for (const [name, l] of Object.entries(r.links)) drug_links[name] = l.url;
  return { answer: reportToMarkdown(r), drug_links, parsed_result: reportToParsedResult(r) };
}
