import { ChevronDown, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { KIND_META, linkPriority, linkSourceLabel, type DrugProfile, type EvidenceSource, type LinkInfo } from "@/lib/report";
import { buildCiteIndex, Cite, CiteProvider, SourceList } from "./Evidence";
import { AiTag, DrugProfiles, PairAnalysisView } from "./PairInsight";
import type { DisplayPair } from "./types";

interface PairCardProps {
  pair: DisplayPair;
  open: boolean;
  onToggle: () => void;
  links: Record<string, LinkInfo>;
  /** Pharmacology profiles by database name. */
  profiles?: Record<string, DrugProfile>;
  /** Evidence cited in the report, by id. */
  evidence?: Record<string, EvidenceSource>;
  onFixDrug?: () => void;
}

/** One pair in plain language: the answer on the header, what happens and the source data when opened. */
export function PairCard({ pair, open, onToggle, links, profiles = {}, evidence = {}, onFixDrug }: PairCardProps) {
  const meta = KIND_META[pair.kind];
  const pendingInteraction = pair.pending && pair.status === "interaction";
  const ingredientPairs = pair.ingredientPairs ?? [];
  const details = [...new Map((pair.sourceRecords ?? []).flatMap((r) => (r.details ?? []).map((d) => [d.pageId, d] as const))).values()];
  const management = [...new Set(details.map((d) => d.management).filter((m): m is string => !!m))];
  // Links are keyed by database name: the drugs themselves, or the interacting ingredients of a product.
  const sources = [...new Set([pair.a, pair.b, ...ingredientPairs.flatMap((i) => [i.a, i.b])])]
    .filter((d) => links[d])
    .sort((x, y) => linkPriority(links[x]!) - linkPriority(links[y]!));
  const pairProfiles = [...new Set(ingredientPairs.length ? ingredientPairs.flatMap((i) => [i.a, i.b]) : [pair.a, pair.b])]
    .map((n) => profiles[n])
    .filter((p): p is DrugProfile => !!p);
  const analysis = !pair.pending && pair.status === "interaction" ? pair.analysis : undefined;
  const detailUrls = new Set(details.map((d) => d.url));
  const ddinterIds = Object.values(evidence)
    .filter((s) => s.kind === "ddinter" && detailUrls.has(s.url))
    .map((s) => s.id);
  const cites = buildCiteIndex(evidence, analysis, pair.status === "interaction" ? pairProfiles : [], ddinterIds);
  const bodyId = `pair-body-${pair.id.replace(/\W/g, "_")}`;

  return (
    <article
      id={`pair-${pair.id.replace(/\W/g, "_")}`}
      className={cn(
        "scroll-mt-24 overflow-hidden rounded-2xl border bg-card",
        open ? "border-[1.5px] border-foreground" : pair.kind === "major" && !pair.pending ? "border-sev-major/30" : "",
      )}
    >
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className={cn("flex min-h-16 w-full flex-wrap items-center gap-x-3.5 gap-y-2 px-4 py-3 text-left sm:px-5", open && "bg-muted/40")}
        >
          <span
            className={cn(
              "w-[118px] shrink-0 rounded-full px-2.5 py-1 text-center text-xs font-bold",
              pendingInteraction ? "bg-foreground text-background" : meta.badge,
            )}
          >
            {pendingInteraction ? "Có tương tác" : meta.label}
          </span>
          <span className="flex min-w-0 flex-[1_1_200px] flex-col leading-snug">
            <span className="text-base font-bold break-words">
              {pair.a} + {pair.b}
            </span>
            <span className="text-sm text-neutral-ink">
              {pendingInteraction ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  Đang đánh giá mức độ…
                </span>
              ) : (
                meta.answer
              )}
            </span>
          </span>
          <ChevronDown className={cn("size-5 shrink-0 text-neutral-ink transition-transform", open && "rotate-180")} aria-hidden="true" />
        </button>
      </h3>

      {open && (
        <CiteProvider index={cites}>
        <div id={bodyId} className="flex flex-col gap-4 border-t px-4 pt-4 pb-5 sm:px-5" aria-live="polite">
          <div className="flex flex-col gap-1">
            <h4 className="text-[13px] font-bold text-neutral-ink">{pair.status === "interaction" ? "Tóm tắt" : "Điều gì xảy ra"}</h4>
            {pair.pending ? (
              <p className="text-muted-foreground">Đang phân tích cơ chế và viết giải thích…</p>
            ) : (
              <p className={cn("max-w-[72ch] leading-relaxed", analysis && "text-[17px] font-semibold")}>{pair.explanation || "Chưa có giải thích cho cặp này."}</p>
            )}
            {pair.status === "no_record" && (
              <p className="max-w-[72ch] text-sm font-semibold text-neutral-ink">
                Không có ghi nhận không có nghĩa là chắc chắn an toàn. Hỏi dược sĩ nếu dùng chung lâu ngày.
              </p>
            )}
          </div>

          {analysis && <PairAnalysisView analysis={analysis} kind={pair.kind} />}

          {management.length > 0 && !pair.pending && (
            <div className="flex max-w-[80ch] flex-col gap-1.5 rounded-xl bg-brand-soft/50 px-4 py-3.5">
              <h4 className="flex flex-wrap items-center gap-2 text-[13px] font-bold text-brand-ink">
                Hướng xử trí theo DDInter (không phải chỉ định cá nhân)
                {analysis?.management_vi && <AiTag />}
              </h4>
              {analysis?.management_vi ? (
                <>
                  <p className="text-sm leading-relaxed">
                    {analysis.management_vi}
                    <Cite ids={ddinterIds} />
                  </p>
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer font-semibold">Nguyên văn tiếng Anh</summary>
                    {management.map((m) => (
                      <p key={m} lang="en" className="mt-1.5 leading-relaxed">
                        {m}
                      </p>
                    ))}
                  </details>
                </>
              ) : (
                management.map((m) => (
                  <p key={m} lang="en" className="text-sm leading-relaxed">
                    {m}
                  </p>
                ))
              )}
            </div>
          )}

          {!pair.pending && pair.status === "interaction" && <DrugProfiles profiles={pairProfiles} />}

          {ingredientPairs.length > 0 && !pair.pending && (
            <div className="flex max-w-[72ch] flex-col gap-1.5">
              <h4 className="text-[13px] font-bold text-neutral-ink">Thành phần gây tương tác ({ingredientPairs.length})</h4>
              <ul className="flex flex-col gap-1.5">
                {ingredientPairs.map((i) => (
                  <li key={`${i.a}|${i.b}`} className="rounded-lg border bg-card px-3 py-2 text-sm">
                    <span className="font-semibold">
                      {i.a} + {i.b}
                    </span>
                    <span lang="en" className="block text-xs text-muted-foreground">
                      {i.condition}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pair.status === "unresolved" && onFixDrug && (
            <div>
              <Button className="h-11 bg-foreground text-background hover:bg-foreground/90" onClick={onFixDrug}>
                Sửa tên hoặc thành phần
              </Button>
            </div>
          )}

          {!pair.pending && <SourceList index={cites} />}

          {!pair.pending && details.length > 0 && (
            <details className="max-w-[80ch] rounded-xl border px-4 py-3 text-sm">
              <summary className="cursor-pointer font-semibold">Dữ liệu gốc DDInter ({details.length})</summary>
              <div className="mt-3 flex flex-col gap-3">
                {details.map((d) => (
                  <section key={d.pageId} className="flex flex-col gap-1.5">
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">
                      DDInter #{d.pageId} · {d.drugAName} + {d.drugBName}
                    </a>
                    <p className="text-xs text-muted-foreground">
                      Mức độ trên trang: {d.level} · Thu thập: {new Date(d.retrievedAt).toLocaleDateString("vi-VN")}
                    </p>
                    {pair.sourceRecords?.some((r) => r.details?.some((x) => x.pageId === d.pageId) && r.level !== d.level) && (
                      <p className="font-semibold">Mức độ trên trang khác dữ liệu CSV. Cần dược sĩ kiểm tra; hệ thống giữ nguyên mức độ đã nhập.</p>
                    )}
                    <p>
                      <span className="font-semibold">Phân loại cơ chế: </span>
                      {d.mechanisms.join(", ") || "Nguồn chưa cung cấp"}
                    </p>
                    <p>
                      <span className="font-semibold">Mô tả: </span>
                      <span lang="en">{d.description ?? "Nguồn chưa cung cấp"}</span>
                    </p>
                    {d.references.length > 0 && (
                      <details>
                        <summary className="cursor-pointer font-semibold">Tài liệu tham khảo ({d.references.length})</summary>
                        <ul className="mt-2 flex flex-col gap-1 text-xs" lang="en">
                          {d.references.map((reference, i) => (
                            <li key={i}>{reference}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </section>
                ))}
              </div>
            </details>
          )}

          {pair.dbCondition && ingredientPairs.length === 0 && details.length === 0 && !pair.pending && (
            <p className="max-w-[72ch] text-xs text-muted-foreground">
              <span className="font-semibold">Mô tả gốc trong cơ sở dữ liệu:</span> <span lang="en">{pair.dbCondition}</span>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
            {pair.severitySource && !pair.pending && (
              <span>{pair.severitySource === "DDInter 2.0" ? "Mức độ từ DDInter 2.0; giải thích do AI tổng hợp." : "Mức độ do AI ước lượng."}</span>
            )}
            {pair.status === "unresolved" && <span>Chưa tra cứu.</span>}
            {sources.map((d) => (
              <a key={d} href={links[d]!.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                Thông tin về {d}
                <span className="font-normal text-muted-foreground">· {linkSourceLabel(links[d]!)}</span>
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
        </CiteProvider>
      )}
    </article>
  );
}
