import { createContext, useContext, type ReactNode } from "react";
import { ExternalLink, FileText, Library, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DrugProfile, EvidenceSource, PairAnalysis } from "@/lib/report";

/** Sources of one card, numbered in the order they are first cited. */
export interface CiteIndex {
  order: string[];
  sources: Record<string, EvidenceSource>;
}

const CiteCtx = createContext<CiteIndex>({ order: [], sources: {} });

export function CiteProvider({ index, children }: { index: CiteIndex; children: ReactNode }) {
  return <CiteCtx.Provider value={index}>{children}</CiteCtx.Provider>;
}

/** Ids in reading order: analysis first, then profiles, then any extra (e.g. the DDInter pages of the pair). */
export function buildCiteIndex(sources: Record<string, EvidenceSource>, analysis: PairAnalysis | undefined, profiles: DrugProfile[], extra: string[]): CiteIndex {
  const order: string[] = [];
  const add = (ids: string[] | undefined) => ids?.forEach((id) => sources[id] && !order.includes(id) && order.push(id));
  if (analysis) {
    add(analysis.why_harmful_sources);
    analysis.chain.forEach((s) => add(s.sources));
    [...analysis.consequences, ...analysis.risk_factors, ...analysis.monitoring].forEach((c) => add(c.sources));
    add(analysis.onset?.sources);
  }
  for (const p of profiles) {
    [p.mechanism, ...p.indications, p.pharmacokinetics, ...p.adverse_effects, p.interaction_role].forEach((c) => add(c?.sources));
  }
  add(extra);
  return { order, sources };
}

/** Superscript-style numbered links to the evidence behind a claim. */
export function Cite({ ids, className }: { ids: string[] | undefined; className?: string }) {
  const { order, sources } = useContext(CiteCtx);
  const known = (ids ?? []).filter((id) => sources[id]).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  if (!known.length) return null;
  return (
    <span className={cn("ml-1 inline-flex flex-wrap gap-0.5 align-[1px]", className)}>
      {known.map((id) => {
        const s = sources[id]!;
        return (
          <a
            key={id}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`${s.publisher}: ${s.title}`}
            className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] bg-brand-soft px-1 text-[11px] leading-none font-bold text-brand-ink no-underline hover:bg-brand-ink hover:text-white"
          >
            {order.indexOf(id) + 1}
          </a>
        );
      })}
    </span>
  );
}

const KIND: Record<EvidenceSource["kind"], { label: string; icon: typeof FileText }> = {
  "fda-label": { label: "Nhãn thuốc FDA", icon: FileText },
  ddinter: { label: "DDInter 2.0", icon: Library },
  literature: { label: "Tài liệu y văn", icon: Library },
};

export function sourceHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Numbered reference list matching the citation chips. */
export function SourceList({ index }: { index: CiteIndex }) {
  if (!index.order.length) return null;
  return (
    <section aria-label="Nguồn tham khảo" className="flex flex-col gap-2 rounded-xl border bg-muted/30 px-4 py-3.5">
      <h4 className="text-[15px] font-bold">Nguồn tham khảo ({index.order.length})</h4>
      <ol className="flex flex-col gap-2">
        {index.order.map((id, i) => {
          const s = index.sources[id]!;
          const k = KIND[s.kind];
          return (
            <li key={id} className="flex gap-2.5 text-sm">
              <span className="flex size-[22px] shrink-0 items-center justify-center rounded-md bg-brand-soft text-xs font-bold text-brand-ink">{i + 1}</span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-semibold break-words text-primary hover:underline">
                  {s.title}
                  <ExternalLink className="ml-1 inline size-3.5 align-[-2px]" aria-hidden="true" />
                </a>
                <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <k.icon className="size-3.5" aria-hidden="true" />
                    {k.label}
                  </span>
                  <span>{s.publisher}</span>
                  <span className="break-all">{sourceHost(s.url)}</span>
                  {s.link === "search" && (
                    <span className="inline-flex items-center gap-1">
                      <Search className="size-3" aria-hidden="true" />
                      Trích dẫn không có PMID/DOI: liên kết tìm trên PubMed
                    </span>
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
