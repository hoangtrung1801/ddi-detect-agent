import { useEffect, useState } from "react";
import { Printer, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { InteractionReport, PairResult, ResolvedDrug } from "@/lib/report";
import { AnalysisProgress } from "./AnalysisProgress";
import { AskAboutResult } from "./AskAboutResult";
import { PairCard } from "./PairCard";
import { PairMatrix } from "./PairMatrix";
import { SourcePhotos } from "./SourcePhotos";
import { Verdict } from "./Verdict";
import type { StepId, StepState } from "./useInteractionCheck";
import type { DisplayDrug, DisplayPair, PhotoEntry } from "./types";

interface ResultsPanelProps {
  drugs: DisplayDrug[];
  pairs: DisplayPair[];
  report: InteractionReport | null;
  running: boolean;
  steps: Record<StepId, StepState>;
  resolved: ResolvedDrug[];
  livePairs: PairResult[];
  /** Inputs the database did not recognise. */
  unresolved: string[];
  stale: boolean;
  photos: PhotoEntry[];
  photoView: string | null;
  onViewPhoto: (id: string | null) => void;
  onSave?: () => void;
  isSaving?: boolean;
  onFixDrug: () => void;
}

const anchor = (id: string) => `pair-${id.replace(/\W/g, "_")}`;

export function ResultsPanel({ drugs, pairs, report, running, steps, resolved, livePairs, unresolved, stale, photos, photoView, onViewPhoto, onSave, isSaving, onFixDrug }: ResultsPanelProps) {
  // undefined: the most serious pair is open; null: all closed.
  const [openId, setOpenId] = useState<string | null | undefined>(undefined);
  const [view, setView] = useState<"list" | "grid">("list");
  const [scrollTo, setScrollTo] = useState<string | null>(null);
  // A pair from an older run falls back to the most serious one too.
  const open = openId === null || pairs.some((p) => p.id === openId) ? openId! : (pairs[0]?.id ?? null);

  useEffect(() => {
    if (!scrollTo) return;
    document.getElementById(anchor(scrollTo))?.scrollIntoView({ behavior: "smooth", block: "start" });
    setScrollTo(null);
  }, [scrollTo]);

  const openPair = (id: string) => {
    setOpenId(id);
    setView("list");
    setScrollTo(id);
  };

  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className={cn("flex min-w-0 flex-[999_1_620px] flex-col gap-5", stale && "opacity-60")}>
        {report ? (
          <Verdict report={report} pairs={pairs} unresolved={unresolved} onOpenPair={openPair} onFixDrug={onFixDrug} />
        ) : (
          <AnalysisProgress steps={steps} running={running} resolved={resolved} pairs={livePairs} />
        )}

        {pairs.length > 0 && (
          <section aria-labelledby="pairs-title" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <h2 id="pairs-title" className="text-lg font-bold">
                Từng cặp thuốc ({pairs.length})
              </h2>
              <div role="group" aria-label="Cách xem" className="flex rounded-[10px] bg-muted p-[3px] print:hidden">
                {(["list", "grid"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    onClick={() => setView(v)}
                    className={cn("h-[38px] rounded-lg px-3.5 text-sm font-semibold", view === v ? "bg-card shadow-sm" : "text-neutral-ink")}
                  >
                    {v === "list" ? "Danh sách" : "Bảng đối chiếu"}
                  </button>
                ))}
              </div>
            </div>
            {view === "grid" && <PairMatrix drugs={drugs} pairs={pairs} onPick={openPair} />}
            {pairs.map((p) => (
              <PairCard
                key={p.id}
                pair={p}
                open={p.id === open}
                onToggle={() => setOpenId(p.id === open ? null : p.id)}
                links={report?.links ?? {}}
                onFixDrug={onFixDrug}
              />
            ))}
          </section>
        )}

        {report && <p className="text-[13px] leading-relaxed text-muted-foreground">{report.disclaimer}</p>}
      </div>

      <aside aria-label="Lưu và hỏi thêm" className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 lg:sticky lg:top-5 print:hidden">
        <section className="flex flex-col gap-2.5 rounded-2xl border bg-card px-5 py-4">
          <h2 className="text-[15px] font-bold">Giữ lại kết quả</h2>
          {onSave && (
            <Button className="h-12 rounded-xl font-semibold" onClick={onSave} disabled={!report || isSaving}>
              <Save aria-hidden="true" />
              Lưu thuốc vào tủ thuốc
            </Button>
          )}
          <Button variant="outline" className="h-11 rounded-xl bg-card font-semibold" onClick={() => window.print()} disabled={!report}>
            <Printer aria-hidden="true" />
            In để mang tới bác sĩ
          </Button>
        </section>
        <SourcePhotos photos={photos} viewId={photoView} onView={onViewPhoto} />
        {report && <AskAboutResult report={report} />}
        <p className="text-[13px] text-muted-foreground">Tra cứu trong DDInter 2.0. Giải thích do AI tổng hợp, chỉ mang tính tham khảo.</p>
      </aside>
    </div>
  );
}
