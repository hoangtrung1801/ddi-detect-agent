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
    <section aria-labelledby="progress-title" className="flex flex-col gap-4 rounded-2xl border bg-card px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-1">
        <div className="text-[13px] font-bold tracking-wider text-muted-foreground uppercase">Kết luận</div>
        <h1 id="progress-title" className="text-2xl leading-tight font-bold tracking-tight sm:text-[28px]" aria-live="polite">
          {running ? "Đang kiểm tra từng cặp thuốc…" : "Không hoàn tất được lần kiểm tra"}
        </h1>
        <p className="text-neutral-ink">{running ? "Các cặp có kết quả sẽ hiện ngay bên dưới." : "Hãy thử kiểm tra lại."}</p>
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
