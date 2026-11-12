import { useEffect, useState } from "react";
import { ALargeSmall, ChevronRight, FileDown, Loader2, Share2, Square, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { KIND_META, RISK_META, type InteractionReport, type PairKind } from "@/lib/report";
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

/** Count phrase per category, most serious first, e.g. "1 cặp tương tác nhẹ". */
const PHRASE: Record<PairKind, string> = {
  major: "cặp nghiêm trọng",
  moderate: "cặp cần theo dõi",
  minor: "cặp tương tác nhẹ",
  unknown: "cặp chưa rõ mức độ",
  no_record: "cặp không có ghi nhận",
  unresolved: "cặp chưa tra được",
};

/** The answer first: one sentence on whether these can be taken together, from the most serious pair down. */
export function headline(pairs: DisplayPair[], unresolved: string[]): { title: string; sub: string } {
  const of = (k: PairKind) => pairs.filter((p) => p.kind === k);
  const more = (list: DisplayPair[]) => (list.length > 1 ? ` và ${list.length - 1} cặp khác` : "");
  const tail = of("unresolved").length ? ` Chưa nhận ra ${join(unresolved.map((u) => `“${u}”`))} nên còn ${of("unresolved").length} cặp chưa kiểm tra.` : "";
  /** The other interaction categories below the headline one. */
  const others = (skip: PairKind) => {
    const parts = (["major", "moderate", "minor", "unknown"] as PairKind[]).filter((k) => k !== skip && of(k).length).map((k) => `${of(k).length} ${PHRASE[k]}`);
    return parts.length ? ` Ngoài ra còn ${join(parts)}.` : "";
  };
  const [major, moderate, minor, unknown] = [of("major"), of("moderate"), of("minor"), of("unknown")];

  if (major[0]) return { title: `Không nên dùng chung ${major[0].a} và ${major[0].b}${more(major)}`, sub: `Đây là tương tác nghiêm trọng.${others("major")}${tail}` };
  if (moderate[0]) return { title: `Dùng chung được nếu theo dõi: ${moderate[0].a} và ${moderate[0].b}${more(moderate)}`, sub: `Không có cặp nào ở mức nghiêm trọng.${others("moderate")}${tail}` };
  if (minor[0]) return { title: `Chỉ có tương tác nhẹ giữa ${minor[0].a} và ${minor[0].b}${more(minor)}`, sub: `Thường vẫn dùng chung được.${others("minor")}${tail}` };
  if (unknown[0])
    return { title: `${unknown[0].a} và ${unknown[0].b}${more(unknown)} có tương tác chưa rõ mức độ`, sub: `Cơ sở dữ liệu ghi nhận tương tác nhưng chưa xếp mức độ; hỏi dược sĩ trước khi dùng chung.${tail}` };
  if (of("no_record").length && !tail)
    return { title: "Không ghi nhận tương tác giữa các thuốc này", sub: "Không có ghi nhận không có nghĩa là chắc chắn an toàn. Hỏi dược sĩ nếu dùng chung lâu ngày." };
  return { title: "Chưa kiểm tra được hết các thuốc", sub: `Không thấy tương tác ở các cặp đã tra.${tail}` };
}

const TALLY: { kind: PairKind; label: string; dot: string }[] = [
  { kind: "major", label: "nghiêm trọng", dot: "bg-sev-major" },
  { kind: "moderate", label: "cần theo dõi", dot: "bg-sev-moderate" },
  { kind: "minor", label: "nhẹ", dot: "bg-sev-minor" },
  { kind: "unknown", label: "chưa rõ mức độ", dot: "bg-neutral-stroke" },
  { kind: "no_record", label: "không có ghi nhận", dot: "border border-neutral-stroke bg-card" },
  { kind: "unresolved", label: "chưa tra được", dot: "border border-dashed border-neutral-stroke bg-card" },
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

/** Plain-text summary for sharing with family or a doctor, with source links. */
function shareText(report: InteractionReport, pairs: DisplayPair[], title: string, sub: string): string {
  const lines = [`DRUG-GUARD AI: ${title}`, sub, ""];
  for (const p of pairs) lines.push(`• ${p.a} + ${p.b}: ${KIND_META[p.kind].label} (${KIND_META[p.kind].answer})`);
  if (report.recommendations.length) lines.push("", "Gợi ý:", ...report.recommendations.map((r, i) => `${i + 1}. ${r}`));
  const src = Object.values(report.sources ?? {});
  if (src.length) lines.push("", "Nguồn:", ...src.map((s) => `- ${s.title}: ${s.url}`));
  lines.push("", "Thông tin tham khảo, không thay thế tư vấn của bác sĩ/dược sĩ.");
  return lines.join("\n");
}

async function share(text: string, title: string) {
  try {
    if (navigator.share) {
      await navigator.share({ title, text });
      return;
    }
    await navigator.clipboard.writeText(text);
    toast.success("Đã sao chép kết quả, dán vào Zalo/Messenger để gửi.");
  } catch (err) {
    if ((err as Error)?.name !== "AbortError") toast.error("Không chia sẻ được, hãy dùng nút Tải PDF.");
  }
}

export function Verdict({ report, pairs, unresolved, onOpenPair, onFixDrug, bigText, onToggleBigText, onDownloadPdf, exporting }: VerdictProps) {
  const meta = RISK_META[report.overall_risk];
  const { title, sub } = headline(pairs, unresolved);
  const speech = useSpeech([title, sub, ...report.recommendations].join(". "));
  const missing = pairs.filter((p) => p.kind === "unresolved").length;
  const tally = TALLY.map((t) => ({ ...t, n: pairs.filter((p) => p.kind === t.kind).length })).filter((t) => t.n > 0);
  // Pairs arrive sorted most serious first: major, moderate, minor, then unknown severity.
  const interacting = pairs.filter((p) => p.status === "interaction");
  const noRecord = pairs.filter((p) => p.kind === "no_record");
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
            <button type="button" onClick={() => share(shareText(report, pairs, title, sub), title)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-current/30 bg-card px-3.5 text-sm font-semibold text-foreground">
              <Share2 className="size-4" aria-hidden="true" />
              Gửi người thân
            </button>
          </div>
        </div>
        <div className="mx-auto sm:mx-0">
          <SeverityGauge risk={report.overall_risk} label={meta.label} />
        </div>
      </div>

      <div className="flex flex-col gap-5 px-5 pt-4 pb-5 sm:px-6">
        <section aria-labelledby="summary-title" className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
            <h2 id="summary-title" className="text-[15px] font-bold text-brand-ink">
              Tóm tắt các tương tác
            </h2>
            <span className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] font-semibold text-neutral-ink">
              {tally.map((t) => (
                <span key={t.kind} className="inline-flex items-center gap-1.5">
                  <span className={cn("size-2.5 rounded-full", t.dot)} aria-hidden="true" />
                  {t.n} {t.label}
                </span>
              ))}
            </span>
          </div>
          {interacting.length > 0 ? (
            <ol className="flex flex-col gap-2">
              {interacting.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onOpenPair(p.id)}
                    className="group flex w-full items-start gap-3 rounded-xl border bg-card px-3.5 py-3 text-left transition-colors hover:border-foreground"
                  >
                    <span className={cn("mt-0.5 hidden w-[96px] shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] leading-tight font-bold sm:block", KIND_META[p.kind].badge)}>
                      {p.kind === "unknown" ? KIND_META.unknown.short : KIND_META[p.kind].label}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={cn("mb-0.5 w-fit rounded-full px-2 py-0.5 text-[11px] leading-tight font-bold sm:hidden", KIND_META[p.kind].badge)}>
                        {p.kind === "unknown" ? KIND_META.unknown.short : KIND_META[p.kind].label}
                      </span>
                      <span className="font-bold">
                        {p.a} + {p.b}
                      </span>
                      <span className="text-sm leading-snug text-neutral-ink">{p.explanation || KIND_META[p.kind].answer}</span>
                    </span>
                    <ChevronRight className="mt-1 size-4 shrink-0 text-neutral-ink transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>
          ) : null}
          {noRecord.length > 0 && (
            <p className="text-sm text-neutral-ink">
              <span className="font-semibold">{noRecord.length} cặp không có ghi nhận:</span> {join(noRecord.map((p) => `${p.a} + ${p.b}`))}. Không có ghi nhận không có nghĩa là chắc chắn an toàn.
            </p>
          )}
          {missing > 0 && (
            <p className="text-sm text-neutral-ink">
              <span className="font-semibold">{missing} cặp chưa tra được.</span>{" "}
              <button type="button" onClick={onFixDrug} className="text-left font-semibold text-primary underline underline-offset-2">
                Sửa tên hoặc thành phần của {join(unresolved.map((u) => `“${u}”`))}
              </button>{" "}
              để kiểm tra nốt.
            </p>
          )}
        </section>

        {steps.length > 0 && (
          <section aria-labelledby="advice-title" className="flex flex-col gap-2.5">
            <h2 id="advice-title" className="text-[15px] font-bold text-brand-ink">
              Gợi ý cho trường hợp của bạn
            </h2>
            <ol className="flex flex-col gap-2.5">
              {steps.map((r, i) => (
                <li key={r} className="flex items-start gap-3">
                  <Num n={i + 1} />
                  <span className="pt-0.5">{r}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </section>
  );
}

function Num({ n }: { n: number }) {
  return <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-bold text-brand-ink">{n}</span>;
}
