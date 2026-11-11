import { useEffect, useState } from "react";
import { ALargeSmall, FileDown, Loader2, Square, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { RISK_META, type InteractionReport, type PairKind } from "@/lib/report";
import { SeverityGauge } from "./SeverityGauge";
import type { DisplayPair } from "./types";

interface VerdictProps {
  report: InteractionReport;
  pairs: DisplayPair[];
  /** Inputs the database did not recognise. */
  unresolved: string[];
  onOpenPair: (id: string) => void;
  onFixDrug: () => void;
  bigText: boolean;
  onToggleBigText: () => void;
  onDownloadPdf: () => void;
  exporting: boolean;
}

const join = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} và ${names.at(-1)}`);

/** The answer first: one sentence on whether these can be taken together, then what to do. */
export function headline(pairs: DisplayPair[], unresolved: string[]): { title: string; sub: string } {
  const of = (...k: PairKind[]) => pairs.filter((p) => k.includes(p.kind));
  const [major, watch, minor, noRecord, missing] = [of("major"), of("moderate", "unknown"), of("minor"), of("no_record"), of("unresolved")];
  const top = pairs[0];
  const more = (list: DisplayPair[]) => (list.length > 1 ? ` và ${list.length - 1} cặp khác` : "");
  const tail = missing.length ? ` Chưa nhận ra ${join(unresolved.map((u) => `“${u}”`))} nên còn ${missing.length} cặp chưa kiểm tra.` : "";

  if (major.length && top)
    return {
      title: `Không nên dùng chung ${top.a} và ${top.b}${more(major)}`,
      sub: `Đây là tương tác nghiêm trọng.${watch.length ? ` Thêm ${watch.length} cặp cần theo dõi.` : ""}${tail}`,
    };
  if (watch.length && top)
    return {
      title: top.kind === "unknown" ? `${top.a} và ${top.b} có tương tác, hỏi dược sĩ trước khi dùng chung` : `Dùng chung được nếu theo dõi: ${top.a} và ${top.b}${more(watch)}`,
      sub: `Không có cặp nào ở mức nghiêm trọng.${tail}`,
    };
  if (minor.length && top) return { title: `Chỉ có tương tác nhẹ giữa ${top.a} và ${top.b}${more(minor)}`, sub: `Thường vẫn dùng chung được.${tail}` };
  if (noRecord.length && !missing.length)
    return { title: "Không ghi nhận tương tác giữa các thuốc này", sub: "Không có ghi nhận không có nghĩa là chắc chắn an toàn. Hỏi dược sĩ nếu dùng chung lâu ngày." };
  return { title: "Chưa kiểm tra được hết các thuốc", sub: `Không thấy tương tác ở các cặp đã tra.${tail}` };
}

const TALLY: { kinds: PairKind[]; label: string; className: string }[] = [
  { kinds: ["major"], label: "Không nên dùng chung", className: "bg-sev-major-soft text-sev-major-ink border-sev-major/30" },
  { kinds: ["moderate", "unknown"], label: "Cần theo dõi", className: "bg-sev-moderate-soft text-sev-moderate-ink border-sev-moderate/40" },
  { kinds: ["minor"], label: "Tương tác nhẹ", className: "bg-sev-minor-soft text-sev-minor border-sev-minor/30" },
  { kinds: ["no_record"], label: "Không có ghi nhận", className: "bg-muted/60 text-neutral-ink border-border" },
  { kinds: ["unresolved"], label: "Chưa tra được", className: "bg-card text-neutral-ink border-dashed border-neutral-stroke" },
];

/** Reads the verdict aloud in Vietnamese where the browser has a speech engine. */
function useSpeech(text: string) {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => (supported ? window.speechSynthesis.cancel() : undefined), [supported]);
  const toggle = () => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "vi-VN";
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("vi"));
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.onend = u.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(u);
    setSpeaking(true);
  };
  return { supported, speaking, toggle };
}

export function Verdict({ report, pairs, unresolved, onOpenPair, onFixDrug, bigText, onToggleBigText, onDownloadPdf, exporting }: VerdictProps) {
  const meta = RISK_META[report.overall_risk];
  const { title, sub } = headline(pairs, unresolved);
  const speech = useSpeech([title, sub, ...report.recommendations].join(". "));
  const missing = pairs.filter((p) => p.kind === "unresolved").length;
  const tally = TALLY.map((t) => ({ ...t, n: pairs.filter((p) => t.kinds.includes(p.kind)).length, first: pairs.find((p) => t.kinds.includes(p.kind)) })).filter(
    (t) => t.n > 0,
  );
  const steps = [...report.recommendations];

  return (
    <section aria-labelledby="verdict-title" className={cn("overflow-hidden rounded-2xl border bg-card", meta.panel.split(" ").find((c) => c.startsWith("border-")))}>
      <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-5 sm:px-6", meta.panel)}>
        <div className="flex min-w-[240px] flex-[1_1_320px] flex-col gap-1.5">
          <div className={cn("text-[13px] font-bold tracking-wider uppercase", meta.title)}>Kết luận · {meta.label}</div>
          <h1 id="verdict-title" className={cn("text-2xl leading-tight font-bold tracking-tight sm:text-[28px]", meta.title)}>
            {title}
          </h1>
          <p className={cn("max-w-[72ch]", meta.title)}>{sub}</p>
          <div className="flex flex-wrap gap-2 pt-1.5 print:hidden">
            {speech.supported && (
              <button type="button" onClick={speech.toggle} aria-pressed={speech.speaking} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-current/30 bg-card px-3.5 text-sm font-semibold text-foreground">
                {speech.speaking ? <Square className="size-3.5" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}
                {speech.speaking ? "Dừng đọc" : "Nghe kết luận"}
              </button>
            )}
            <button type="button" onClick={onToggleBigText} aria-pressed={bigText} className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold", bigText ? "border-foreground bg-foreground text-background" : "border-current/30 bg-card text-foreground")}>
              <ALargeSmall className="size-4" aria-hidden="true" />
              Chữ lớn
            </button>
            <button type="button" onClick={onDownloadPdf} disabled={exporting} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-current/30 bg-card px-3.5 text-sm font-semibold text-foreground disabled:opacity-60">
              {exporting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileDown className="size-4" aria-hidden="true" />}
              {exporting ? "Đang tạo PDF…" : "Tải PDF"}
            </button>
          </div>
        </div>
        <div className="mx-auto sm:mx-0">
          <SeverityGauge risk={report.overall_risk} label={meta.label} />
        </div>
      </div>

      <div className="flex flex-col gap-3.5 px-5 pt-4 pb-5 sm:px-6">
        {(steps.length > 0 || missing > 0) && (
          <>
            <h2 className="text-[15px] font-bold text-brand-ink">Việc bạn nên làm</h2>
            <ol className="flex flex-col gap-2.5">
              {steps.map((r, i) => (
                <li key={r} className="flex items-start gap-3">
                  <Num n={i + 1} />
                  <span className="pt-0.5">{r}</span>
                </li>
              ))}
              {missing > 0 && (
                <li className="flex items-start gap-3">
                  <Num n={steps.length + 1} />
                  <span className="pt-0.5">
                    <button type="button" onClick={onFixDrug} className="text-left font-semibold text-primary underline underline-offset-2">
                      Sửa tên hoặc thành phần của {join(unresolved.map((u) => `“${u}”`))}
                    </button>{" "}
                    để kiểm tra nốt {missing} cặp còn lại.
                  </span>
                </li>
              )}
            </ol>
          </>
        )}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2 pt-1">
          {tally.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => t.first && onOpenPair(t.first.id)}
              className={cn("flex flex-col rounded-xl border px-3.5 py-2.5 text-left transition-colors hover:border-foreground", t.className)}
            >
              <span className="text-2xl leading-tight font-bold tabular-nums">{t.n}</span>
              <span className="text-[13px] font-semibold">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function Num({ n }: { n: number }) {
  return <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-bold text-brand-ink">{n}</span>;
}
