import { useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { KIND_META, KIND_ORDER, type InteractionReport } from "@/lib/report";
import { InteractionMap } from "./InteractionMap";
import { PairDetail } from "./PairDetail";
import { RiskBanner } from "./RiskBanner";
import { AskAboutResult } from "./AskAboutResult";
import type { DisplayDrug, DisplayPair, KindFilter } from "./types";

interface ResultsPanelProps {
  drugs: DisplayDrug[];
  pairs: DisplayPair[];
  report: InteractionReport | null;
  running: boolean;
  onSave?: () => void;
  isSaving?: boolean;
  onFixDrug?: () => void;
}

export function ResultsPanel({ drugs, pairs, report, running, onSave, isSaving, onFixDrug }: ResultsPanelProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const [pickedFilter, setFilter] = useState<KindFilter>("all");
  const [focus, setFocus] = useState<string | null>(null);

  // Fall back to the most serious pair when nothing (or a pair from an older run) is picked.
  const selected = pairs.find((p) => p.id === picked) ?? pairs[0] ?? null;
  const index = selected ? pairs.indexOf(selected) : -1;
  const activeFocus = focus && drugs.some((d) => d.label === focus) ? focus : null;

  const counts = useMemo(() => {
    const c = new Map<KindFilter, number>([["all", pairs.length]]);
    for (const p of pairs) c.set(p.kind, (c.get(p.kind) ?? 0) + 1);
    return c;
  }, [pairs]);

  const filters: KindFilter[] = ["all", ...KIND_ORDER.filter((k) => counts.get(k))];
  // A filter for a kind the current result no longer has falls back to "all".
  const filter = filters.includes(pickedFilter) ? pickedFilter : "all";

  const isVisible = (p: DisplayPair) =>
    (filter === "all" || p.kind === filter) && (!activeFocus || p.a === activeFocus || p.b === activeFocus);
  const list = pairs.filter(isVisible);
  const step = (d: number) => {
    if (!pairs.length) return;
    setPicked(pairs[(index + d + pairs.length) % pairs.length]!.id);
  };
  const select = (id: string) => {
    setPicked(id);
    // Make sure the picked pair is not hidden behind the current filters.
    const p = pairs.find((x) => x.id === id);
    if (p && !isVisible(p)) {
      setFilter("all");
      setFocus(null);
    }
  };

  if (!pairs.length && !running) {
    return (
      <section className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-neutral-line bg-card px-6 py-12 text-center">
        <h2 className="text-lg font-bold">Kết quả sẽ hiện ở đây</h2>
        <p className="max-w-md text-muted-foreground">
          Thêm ít nhất 2 thuốc rồi bấm Kiểm tra. Mỗi cặp thuốc sẽ được tra cứu trong cơ sở dữ liệu và hiển thị trên sơ đồ.
        </p>
        <div className="flex flex-wrap justify-center gap-2 text-xs">
          {KIND_ORDER.map((k) => (
            <span key={k} className={cn("rounded-full px-2.5 py-0.5 font-semibold", KIND_META[k].badge)}>
              {KIND_META[k].label}
            </span>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {report && <RiskBanner risk={report.overall_risk} pairs={pairs} onSelectPair={select} onSave={onSave} isSaving={isSaving} />}

      <section aria-labelledby="map-title" className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-col gap-3.5 px-5 pt-5 sm:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="map-title" className="text-[17px] font-bold">
              Sơ đồ tương tác
            </h2>
            <span className="text-sm text-muted-foreground">
              {running && !report ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  Đang phân tích…
                </span>
              ) : (
                "Bấm vào một thuốc hoặc một đường nối để xem chi tiết"
              )}
            </span>
          </div>
          {pairs.length > 0 && (
            <div role="group" aria-label="Lọc theo mức độ" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              {filters.map((f) => {
                const on = filter === f;
                return (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors",
                      on ? "border-foreground bg-foreground text-background" : "border-input bg-card hover:border-foreground",
                    )}
                  >
                    <span className={cn("size-2.5 rounded-[3px]", f === "all" ? "bg-foreground" : KIND_META[f].fill, on && f === "all" && "bg-background")} />
                    {f === "all" ? "Tất cả" : KIND_META[f].label}
                    <span className="tabular-nums opacity-75">{counts.get(f)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-3 pt-2 pb-1 sm:px-6">
          {drugs.length > 0 ? (
            <InteractionMap
              drugs={drugs}
              pairs={pairs}
              selectedId={selected?.id ?? null}
              focus={activeFocus}
              isVisible={isVisible}
              onSelectPair={select}
              onToggleFocus={(label) => setFocus((f) => (f === label ? null : label))}
            />
          ) : (
            <div className="flex h-48 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
              Đang nhận diện thuốc…
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-5 pb-4 text-xs text-muted-foreground sm:px-6">
          <span>Đường càng đậm, tương tác càng nặng</span>
          <span>Nét đứt: chưa nhận diện được thuốc</span>
          {activeFocus && (
            <button type="button" onClick={() => setFocus(null)} className="font-semibold text-primary underline">
              Bỏ chọn {activeFocus}
            </button>
          )}
        </div>

        {selected && (
          <div className="border-t bg-muted/40 px-5 py-5 sm:px-6">
            <PairDetail
              pair={selected}
              index={index}
              total={pairs.length}
              links={report?.links ?? {}}
              onPrev={() => step(-1)}
              onNext={() => step(1)}
              onFixDrug={onFixDrug}
            />
          </div>
        )}
      </section>

      {report && report.recommendations.length > 0 && (
        <section aria-labelledby="rec-title" className="flex flex-col gap-3 rounded-2xl border bg-card px-5 py-5 sm:px-6">
          <h2 id="rec-title" className="text-base font-bold text-brand-ink">
            Nên làm gì
          </h2>
          <ul className="flex flex-col gap-2.5">
            {report.recommendations.map((r) => (
              <li key={r} className="flex gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2.5} aria-hidden="true" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pairs.length > 0 && (
        <section aria-labelledby="list-title" className="flex flex-col gap-2 rounded-2xl border bg-card px-5 py-5 sm:px-6">
          <h2 id="list-title" className="mb-1 text-base font-bold">
            Danh sách cặp ({list.length})
          </h2>
          {list.map((p) => {
            const on = p.id === selected?.id;
            const meta = KIND_META[p.kind];
            const pendingInteraction = p.pending && p.status === "interaction";
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked(p.id)}
                className={cn(
                  "flex min-h-13 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3.5 py-2 text-left transition-colors",
                  on ? "border-2 border-foreground bg-muted/60" : "border hover:border-foreground",
                )}
              >
                <span
                  className={cn(
                    "w-28 shrink-0 rounded-full px-2.5 py-0.5 text-center text-xs font-bold",
                    pendingInteraction ? "bg-foreground text-background" : meta.badge,
                  )}
                >
                  {pendingInteraction ? "Có tương tác" : meta.label}
                </span>
                <span className="min-w-0 flex-1 font-semibold">
                  {p.a} + {p.b}
                </span>
                {p.explanation && !p.pending && (
                  <span className="line-clamp-1 basis-full text-sm text-muted-foreground sm:basis-auto sm:max-w-[45%]">{p.explanation}</span>
                )}
              </button>
            );
          })}
          {list.length === 0 && <p className="text-muted-foreground">Không có cặp nào khớp bộ lọc.</p>}
        </section>
      )}

      {report && <AskAboutResult report={report} />}

      {report && <p className="text-xs leading-relaxed text-muted-foreground">{report.disclaimer}</p>}
    </div>
  );
}
