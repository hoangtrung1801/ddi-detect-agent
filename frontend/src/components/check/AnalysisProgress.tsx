import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResolvedDrug, PairResult } from "@/lib/report";
import type { StepId, StepState } from "./useInteractionCheck";

interface AnalysisProgressProps {
  steps: Record<StepId, StepState>;
  running: boolean;
  resolved: ResolvedDrug[];
  pairs: PairResult[];
}

export function AnalysisProgress({ steps, running, resolved, pairs }: AnalysisProgressProps) {
  const matched = resolved.filter((d) => d.dbName).length;
  const count = (s: PairResult["status"]) => pairs.filter((p) => p.status === s).length;
  const pairNote = pairs.length
    ? [
        count("interaction") && `${count("interaction")} có ghi nhận`,
        count("no_record") && `${count("no_record")} chưa có dữ liệu`,
        count("unresolved") && `${count("unresolved")} không xác định`,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const rows: { id: StepId; title: string; note?: string }[] = [
    { id: "resolve", title: "Nhận diện tên thuốc", note: resolved.length ? `${matched}/${resolved.length} khớp với cơ sở dữ liệu` : undefined },
    { id: "pairs", title: pairs.length ? `Tra cứu ${pairs.length} cặp tương tác` : "Tra cứu các cặp tương tác", note: pairNote || undefined },
    { id: "links", title: "Tìm nguồn tham khảo" },
    { id: "report", title: "Tổng hợp báo cáo" },
  ];

  return (
    <section aria-labelledby="progress-title" className="flex flex-col gap-3 rounded-2xl border bg-card px-6 py-5">
      <div className="flex items-baseline justify-between">
        <h2 id="progress-title" className="text-sm font-semibold">
          Quá trình phân tích
        </h2>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {running ? "Đang chạy…" : "Hoàn tất"}
        </span>
      </div>
      <ol className="flex flex-col gap-2.5">
        {rows.map((r) => {
          const st = steps[r.id];
          return (
            <li key={r.id} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-full",
                  st === "done" ? "bg-brand-soft text-primary" : st === "active" ? "bg-primary text-primary-foreground" : "border border-input",
                )}
              >
                {st === "done" && <Check className="size-3" strokeWidth={3} aria-hidden="true" />}
                {st === "active" && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
              </span>
              <div className={cn(st === "pending" && "text-muted-foreground")}>
                <div className="font-medium">{r.title}</div>
                {r.note && <div className="text-sm text-muted-foreground">{r.note}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
