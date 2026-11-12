import { useEffect, useState, type ReactNode } from "react";
import { Check, FileText, Library, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EvidenceSource, PairResult, ResolvedDrug } from "@/lib/report";
import type { StepId, StepState } from "./useInteractionCheck";

interface AnalysisProgressProps {
  steps: Record<StepId, StepState>;
  running: boolean;
  resolved: ResolvedDrug[];
  pairs: PairResult[];
  /** Source documents read so far (FDA labels, DDInter pages). */
  evidence?: EvidenceSource[];
  startedAt?: number | null;
}

function useElapsed(startedAt: number | null | undefined, running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  return startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0;
}

/** The work as it happens: which drugs were recognised, what the database found, which documents are being read. */
export function AnalysisProgress({ steps, running, resolved, pairs, evidence = [], startedAt }: AnalysisProgressProps) {
  const elapsed = useElapsed(startedAt, running);
  const matched = resolved.filter((d) => d.dbName).length;
  const count = (s: PairResult["status"]) => pairs.filter((p) => p.status === s).length;
  const found = count("interaction");
  const pairNote = pairs.length
    ? [found && `${found} cặp có tương tác`, count("no_record") && `${count("no_record")} cặp chưa có dữ liệu`, count("unresolved") && `${count("unresolved")} cặp chưa nhận ra thuốc`]
        .filter(Boolean)
        .join(" · ")
    : "";
  // Documents are read right after the database lookup, only for pairs that interact.
  const docState: StepState = evidence.length ? "done" : found ? "active" : steps.pairs === "done" ? "done" : "pending";
  const writing: StepState = steps.report === "done" ? "done" : evidence.length || (steps.pairs === "done" && !found) ? "active" : "pending";

  const rows: { id: string; st: StepState; title: string; note?: ReactNode }[] = [
    {
      id: "resolve",
      st: steps.resolve,
      title: "Nhận diện hoạt chất",
      note: resolved.length ? (
        <span className="flex flex-wrap gap-1.5 pt-0.5">
          {resolved.map((d) => (
            <span key={d.input} className={cn("rounded-md px-2 py-0.5 text-[13px]", d.dbName ? "bg-brand-soft text-brand-ink" : "border border-dashed")}>
              {d.dbName && d.dbName.toLowerCase() !== d.input.toLowerCase() ? `${d.input} → ${d.dbName}` : (d.dbName ?? `${d.input}?`)}
            </span>
          ))}
          <span className="text-[13px]">({matched}/{resolved.length} khớp)</span>
        </span>
      ) : undefined,
    },
    {
      id: "pairs",
      st: steps.pairs,
      title: pairs.length ? `Đối chiếu ${pairs.length} cặp với 160.235 tương tác trong DDInter 2.0` : "Đối chiếu với cơ sở dữ liệu tương tác DDInter 2.0",
      note: pairNote || undefined,
    },
    {
      id: "docs",
      st: docState,
      title: evidence.length ? `Đọc ${evidence.length} tài liệu gốc` : "Đọc tài liệu gốc (nhãn thuốc FDA, chuyên khảo DDInter)",
      note: evidence.length ? (
        <ul className="flex flex-col gap-1 pt-1">
          {evidence.map((s, i) => (
            <li key={s.id} className="dg-reveal flex items-center gap-1.5 text-[13px]" style={{ animationDelay: `${i * 120}ms` }}>
              {s.kind === "fda-label" ? <FileText className="size-3.5 shrink-0 text-brand-ink" aria-hidden="true" /> : <Library className="size-3.5 shrink-0 text-brand-ink" aria-hidden="true" />}
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {s.title}
              </a>
              <Check className="size-3.5 shrink-0 text-primary" strokeWidth={3} aria-hidden="true" />
            </li>
          ))}
        </ul>
      ) : undefined,
    },
    {
      id: "report",
      st: writing,
      title: "AI viết giải thích tiếng Việt và kiểm tra từng trích dẫn",
      note: writing === "active" ? "Câu nào không có nguồn sẽ bị loại bỏ trước khi hiển thị." : undefined,
    },
  ];

  return (
    <section aria-labelledby="progress-title" className="flex flex-col gap-4 rounded-2xl border bg-card px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[13px] font-bold tracking-wider text-muted-foreground uppercase">Đang phân tích</div>
          {running && startedAt && <div className="text-[13px] font-semibold text-muted-foreground tabular-nums">{elapsed} giây</div>}
        </div>
        <h1 id="progress-title" className="text-2xl leading-tight font-bold tracking-tight sm:text-[28px]" aria-live="polite">
          {running ? (found ? `Phát hiện ${found} cặp có tương tác, đang tìm hiểu lý do…` : "Đang kiểm tra từng cặp thuốc…") : "Không hoàn tất được lần kiểm tra"}
        </h1>
        <p className="text-neutral-ink">{running ? "Thường mất 30–60 giây vì hệ thống đọc tài liệu gốc của từng thuốc." : "Hãy thử kiểm tra lại."}</p>
      </div>
      {running && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full rounded-full bg-primary transition-[width] duration-1000" style={{ width: `${Math.min(95, 8 + (rows.filter((r) => r.st === "done").length / rows.length) * 70 + Math.min(17, elapsed / 4))}%` }} />
        </div>
      )}
      <ol className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.id} className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-full",
                r.st === "done" ? "bg-brand-soft text-primary" : r.st === "active" ? "bg-primary text-primary-foreground" : "border border-input",
              )}
            >
              {r.st === "done" && <Check className="size-3" strokeWidth={3} aria-hidden="true" />}
              {r.st === "active" && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
            </span>
            <div className={cn("min-w-0", r.st === "pending" && "text-muted-foreground")}>
              <div className="font-medium">{r.title}</div>
              {r.note && <div className="text-sm text-muted-foreground">{r.note}</div>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
