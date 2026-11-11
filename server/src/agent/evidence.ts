import { excerpt, mentioning, type DrugLabel } from '../domain/drug-labels.ts';
import type { EvidenceSource } from '../schemas/report.ts';
import type { PairResult, RunContext } from './context.ts';

/** A direct link when the citation carries a PMID or DOI, otherwise a PubMed search for the citation text. */
export function literatureLink(ref: string): { url: string; link: 'direct' | 'search' } {
  const pmid = /PMID:?\s*(\d{5,9})/i.exec(ref)?.[1];
  if (pmid) return { url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`, link: 'direct' };
  const doi = /\b(10\.\d{4,9}\/[^\s"<>]+[^\s"<>.,;)])/i.exec(ref)?.[1];
  if (doi) return { url: `https://doi.org/${doi}`, link: 'direct' };
  return { url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(ref.slice(0, 250))}`, link: 'search' };
}

/** Database names taking part in recorded interactions, with the names of their partners. */
export function interactingDrugs(pairs: PairResult[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const add = (x: string, y: string) => {
    if (!out.has(x)) out.set(x, new Set());
    out.get(x)!.add(y);
  };
  for (const p of pairs) {
    if (p.status !== 'interaction') continue;
    for (const [x, y] of p.ingredientPairs ? p.ingredientPairs.map((i) => [i.a, i.b] as const) : [[p.a, p.b] as const]) {
      add(x, y);
      add(y, x);
    }
  }
  return out;
}

function labelText(s: EvidenceSource, l: DrugLabel, partners: string[]): string {
  const sec = l.sections;
  const parts: [string, string | undefined][] = [
    ['Boxed warning', excerpt(sec.boxedWarning, 400)],
    ['Indications', excerpt(sec.indications, 500)],
    ['Mechanism of action', excerpt(sec.mechanism, 700)],
    ['Pharmacokinetics', excerpt(sec.pharmacokinetics, 1000)],
    ['Adverse reactions', excerpt(sec.adverseReactions, 500)],
    [`Drug interactions mentioning ${partners.join(', ')}`, mentioning(sec.drugInteractions, partners, 900)],
  ];
  return `[${s.id}] ${s.title} (${s.url})\n${parts
    .filter(([, v]) => v)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n')}`;
}

/**
 * Register every citable source for the run's interactions (DDInter pages, their literature references, FDA labels
 * of the interacting drugs) and return them as text for the model. Never throws.
 */
export async function gatherEvidence(ctx: RunContext, pairs: PairResult[]): Promise<string> {
  const blocks: string[] = [];
  for (const p of pairs) {
    if (p.status !== 'interaction') continue;
    for (const d of (p.sourceRecords ?? []).flatMap((r) => r.details ?? [])) {
      const s = ctx.addSource({ kind: 'ddinter', title: `DDInter 2.0 #${d.pageId}: ${d.drugAName} + ${d.drugBName}`, url: d.url, publisher: 'DDInter 2.0', retrievedAt: d.retrievedAt, link: 'direct' });
      const refs = d.references.map((ref) => ctx.addSource({ kind: 'literature', title: ref, publisher: 'Tài liệu DDInter trích dẫn', ...literatureLink(ref) }));
      blocks.push(
        `[${s.id}] ${s.title} (${s.url})\n  Level: ${d.level}; mechanism categories: ${d.mechanisms.join(', ') || 'not provided'}\n  Description: ${d.description ?? 'not provided'}\n  Management: ${d.management ?? 'not provided'}` +
          (refs.length ? `\n  Cited literature: ${refs.map((r) => `[${r.id}] ${r.title}`).join(' | ')}` : ''),
      );
    }
  }
  const drugs = interactingDrugs(pairs);
  const labelFn = ctx.deps.labelFn;
  if (labelFn && drugs.size) {
    const labels = await Promise.all([...drugs.keys()].map(async (n) => [n, await labelFn(n).catch(() => null)] as const));
    for (const [n, l] of labels) {
      if (!l) {
        blocks.push(`(No FDA label found for ${n}: do not write label-based claims for it.)`);
        continue;
      }
      const s = ctx.addSource({ kind: 'fda-label', title: `FDA label (DailyMed): ${l.generic}`, url: l.url, publisher: 'U.S. FDA / NLM DailyMed', drug: n, link: 'direct', ...(l.effectiveTime ? { retrievedAt: l.effectiveTime } : {}) });
      blocks.push(labelText(s, l, [...drugs.get(n)!]));
    }
  }
  return blocks.length ? `\n\nEVIDENCE SOURCES (cite these ids; every claim in analysis and drug_profiles needs at least one):\n${blocks.join('\n')}` : '';
}
