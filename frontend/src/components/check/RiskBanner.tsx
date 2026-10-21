import { AlertTriangle, CheckCircle2, Info, Printer, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { KIND_META, RISK_META, type OverallRisk } from "@/lib/report";
import type { DisplayPair } from "./types";

const GAUGE = [
  { label: "Không", color: "bg-neutral-line" },
  { label: "Thấp", color: "bg-sev-minor" },
  { label: "Trung bình", color: "bg-sev-moderate" },
  { label: "Cao", color: "bg-sev-major" },
];

interface RiskBannerProps {
  risk: OverallRisk;
  pairs: DisplayPair[];
  onSelectPair: (id: string) => void;
  onSave?: () => void;
  isSaving?: boolean;
}

export function RiskBanner({ risk, pairs, onSelectPair, onSave, isSaving }: RiskBannerProps) {
  const meta = RISK_META[risk];
  const Icon = meta.icon === "alert" ? AlertTriangle : meta.icon === "check" ? CheckCircle2 : Info;
  const interactions = pairs.filter((p) => p.status === "interaction");
  const major = interactions.filter((p) => p.kind === "major").length;
  const noRecord = pairs.filter((p) => p.status === "no_record").length;
  const unresolved = pairs.filter((p) => p.status === "unresolved").length;
  const top = interactions[0];

  const parts: string[] = [];
  if (interactions.length) parts.push(`${interactions.length} cặp có tương tác${major ? `, trong đó ${major} nghiêm trọng` : ""}`);
  if (noRecord) parts.push(`${noRecord} cặp chưa có dữ liệu`);
  if (unresolved) parts.push(`${unresolved} cặp không xác định được`);

  return (
    <section aria-labelledby="risk-title" className={cn("overflow-hidden rounded-2xl border bg-card")}>
      <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-4 border-b px-5 py-5 sm:px-6", meta.panel)}>
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-3">
          <div className="flex items-center gap-3">
            <Icon className={cn("size-7 shrink-0", meta.title)} aria-hidden="true" />
            <div>
              <div className={cn("text-xs font-semibold tracking-wider uppercase", meta.title)}>Mức nguy cơ tổng thể</div>
              <h2 id="risk-title" className={cn("text-2xl font-bold tracking-tight sm:text-[28px]", meta.title)}>
                {meta.label}
              </h2>
            </div>
          </div>
          <div
            role="img"
            aria-label={meta.step === null ? "Chưa đủ dữ liệu để xếp mức nguy cơ" : `Thang nguy cơ: ${GAUGE[meta.step]!.label}`}
            className="flex max-w-[420px] flex-col gap-1.5"
          >
            <div className="grid grid-cols-4 gap-1">
              {GAUGE.map((g, i) => (
                <div
                  key={g.label}
                  className={cn(
                    "h-2.5 rounded-full transition-opacity",
                    g.color,
                    meta.step === null ? "opacity-25" : i === meta.step ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : "opacity-40",
                  )}
                />
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1 text-xs text-muted-foreground">
              {GAUGE.map((g, i) => (
                <span key={g.label} className={cn(i === meta.step && "font-bold text-foreground")}>
                  {g.label}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {onSave && (
            <Button variant="outline" className="h-11 bg-card" onClick={onSave} disabled={isSaving}>
              <Save aria-hidden="true" />
              Lưu vào tủ thuốc
            </Button>
          )}
          <Button variant="outline" className="h-11 bg-card" onClick={() => window.print()}>
            <Printer aria-hidden="true" />
            In / PDF
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-2 px-5 py-4 text-sm sm:px-6">
        {parts.length > 0 && <p className="text-neutral-ink">{parts.join(" · ")}.</p>}
        {top && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Cần chú ý nhất:</span>
            <button
              type="button"
              onClick={() => onSelectPair(top.id)}
              className={cn("min-h-9 rounded-full px-3 py-1 text-left text-sm font-semibold", KIND_META[top.kind].soft)}
            >
              {top.a} + {top.b} · {KIND_META[top.kind].label}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
