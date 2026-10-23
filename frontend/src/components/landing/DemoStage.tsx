import { useState } from "react";
import { cn } from "@/lib/utils";

type Kind = "major" | "moderate" | "minor" | "none";

const KIND: Record<Kind, { label: string; chipLabel: string; stroke: string; width: number; dashed: boolean; chip: string; rank: number }> = {
  major: { label: "Nghiêm trọng", chipLabel: "Nghiêm trọng", stroke: "var(--color-sev-major)", width: 7, dashed: false, chip: "bg-sev-major-soft text-sev-major-ink", rank: 0 },
  moderate: { label: "Trung bình", chipLabel: "Trung bình", stroke: "var(--color-sev-moderate)", width: 5, dashed: false, chip: "bg-sev-moderate-soft text-sev-moderate-ink", rank: 1 },
  minor: { label: "Nhẹ", chipLabel: "Nhẹ", stroke: "var(--color-sev-minor)", width: 3, dashed: false, chip: "bg-sev-minor-soft text-sev-minor", rank: 2 },
  none: { label: "Chưa có dữ liệu", chipLabel: "Chưa có DL", stroke: "var(--color-neutral-stroke)", width: 2.5, dashed: true, chip: "bg-neutral-soft text-neutral-ink", rank: 3 },
};

const NO_DATA = "Không có ghi nhận trong cơ sở dữ liệu. Không có dữ liệu không có nghĩa là chắc chắn an toàn.";

// Illustrative examples only; the explanations are not taken from the server's data.
const EXAMPLES: { name: string; drugs: [string, string, string]; pairs: { kind: Kind; text: string }[] }[] = [
  {
    name: "Giảm đau + chống đông",
    drugs: ["Warfarin", "Ibuprofen", "Paracetamol"],
    pairs: [
      { kind: "major", text: "Tăng nguy cơ chảy máu, kể cả xuất huyết tiêu hoá. Nên tránh dùng chung; hỏi bác sĩ về thuốc giảm đau thay thế." },
      { kind: "moderate", text: "Dùng Paracetamol liều cao, kéo dài có thể làm tăng INR. Báo bác sĩ nếu bạn dùng thường xuyên." },
      { kind: "none", text: NO_DATA },
    ],
  },
  {
    name: "Mỡ máu + kháng sinh",
    drugs: ["Simvastatin", "Clarithromycin", "Amlodipine"],
    pairs: [
      { kind: "major", text: "Clarithromycin làm tăng mạnh nồng độ Simvastatin, có thể gây tổn thương cơ nặng. Thường không dùng chung." },
      { kind: "moderate", text: "Amlodipine làm tăng nồng độ Simvastatin; liều Simvastatin thường được giới hạn." },
      { kind: "moderate", text: "Clarithromycin có thể làm tăng tác dụng hạ huyết áp của Amlodipine. Theo dõi chóng mặt, phù chân." },
    ],
  },
  {
    name: "Cảm cúm",
    drugs: ["Paracetamol", "Loratadine", "Vitamin C"],
    pairs: [
      { kind: "none", text: NO_DATA },
      { kind: "none", text: NO_DATA },
      { kind: "none", text: NO_DATA },
    ],
  },
];

// Triangle layout in a 400×300 frame: node positions, then each pair's ends and label position.
const NODES = [
  { x: 80, y: 232 },
  { x: 320, y: 232 },
  { x: 200, y: 62 },
];
const ENDS: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 2],
];
const CHIPS = [
  { x: 200, y: 232 },
  { x: 140, y: 147 },
  { x: 260, y: 147 },
];
const pct = (v: number, of: number) => `${(v / of) * 100}%`;

/** Interactive example map for the landing page; the lp-st-* classes let the story section animate it on scroll. */
export function DemoStage() {
  const [exIndex, setExIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const ex = EXAMPLES[exIndex]!;

  const worstIndex = ex.pairs.reduce((best, p, i) => (KIND[p.kind].rank < KIND[ex.pairs[best]!.kind].rank ? i : best), 0);
  const selected = picked ?? worstIndex;
  const sel = ex.pairs[selected]!;
  const selEnds = ENDS[selected]!;
  const worst = ex.pairs[worstIndex]!.kind;
  const count = (k: Kind) => ex.pairs.filter((p) => p.kind === k).length;

  const risk = {
    major: { label: "Rủi ro cao", text: `${count("major")} cặp nghiêm trọng, ${count("moderate")} cặp trung bình`, panel: "bg-sev-major-soft/50", title: "text-sev-major-ink", steps: 3, fill: "bg-sev-major" },
    moderate: { label: "Rủi ro trung bình", text: `${count("moderate")} cặp cần theo dõi`, panel: "bg-sev-moderate-soft/50", title: "text-sev-moderate-ink", steps: 2, fill: "bg-sev-moderate" },
    minor: { label: "Rủi ro thấp", text: "Chỉ có tương tác nhẹ", panel: "bg-sev-minor-soft/50", title: "text-sev-minor", steps: 1, fill: "bg-sev-minor" },
    none: { label: "Không tìm thấy tương tác", text: "Không có ghi nhận, nhưng chưa chắc là an toàn", panel: "bg-muted/40", title: "text-neutral-ink", steps: 0, fill: "" },
  }[worst];

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Chọn ví dụ" className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((e, i) => (
          <button
            key={e.name}
            type="button"
            aria-pressed={i === exIndex}
            onClick={() => {
              setExIndex(i);
              setPicked(null);
            }}
            className={cn(
              "min-h-10 rounded-full border px-3.5 text-sm font-semibold transition-colors",
              i === exIndex ? "border-foreground bg-foreground text-background" : "border-input bg-card hover:border-foreground",
            )}
          >
            {e.name}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-[20px] border bg-card shadow-[0_24px_60px_rgba(15,26,36,0.08)]">
        <div className={cn("lp-st-risk flex items-center gap-3 border-b px-4.5 py-3.5", risk.panel)}>
          <div className="flex gap-[3px]" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className={cn("h-2 w-[18px] rounded-[3px]", i < risk.steps ? risk.fill : "bg-border")} />
            ))}
          </div>
          <div className="min-w-0">
            <div className={cn("font-bold", risk.title)}>{risk.label}</div>
            <div className="text-[13px] text-neutral-ink">{risk.text}</div>
          </div>
        </div>

        <div className="relative mx-auto aspect-[4/3] max-h-[340px] w-full">
          <svg viewBox="0 0 400 300" className="lp-st-lines absolute inset-0 h-full w-full" aria-hidden="true">
            {ex.pairs.map((p, i) => {
              const [a, b] = ENDS[i]!.map((n) => NODES[n]!);
              const k = KIND[p.kind];
              const on = i === selected;
              return (
                <line
                  key={i}
                  x1={a!.x}
                  y1={a!.y}
                  x2={b!.x}
                  y2={b!.y}
                  stroke={k.stroke}
                  strokeWidth={k.width + (on ? 3 : 0)}
                  strokeDasharray={k.dashed ? "7 7" : undefined}
                  strokeLinecap="round"
                  strokeOpacity={on ? 1 : 0.55}
                  className="transition-all duration-300"
                />
              );
            })}
          </svg>

          {ex.pairs.map((p, i) => {
            const k = KIND[p.kind];
            const on = i === selected;
            const [a, b] = ENDS[i]!;
            return (
              <button
                key={i}
                type="button"
                aria-pressed={on}
                aria-label={`${ex.drugs[a]} và ${ex.drugs[b]}: ${k.label}`}
                onClick={() => setPicked(i)}
                className={cn(
                  "lp-st-chip absolute min-h-[30px] rounded-full border-2 px-2.5 text-xs font-bold whitespace-nowrap transition-colors",
                  k.chip,
                  on ? "border-foreground" : "border-card",
                )}
                style={{ left: pct(CHIPS[i]!.x, 400), top: pct(CHIPS[i]!.y, 300), transform: "translate(-50%, -50%)" }}
              >
                {k.chipLabel}
              </button>
            );
          })}

          {ex.drugs.map((d, i) => {
            const hot = i === selEnds[0] || i === selEnds[1];
            return (
              <span
                key={i}
                className={cn(
                  "lp-st-node absolute w-[27%] rounded-xl border-[1.5px] px-1.5 py-2 text-center text-[13px] leading-tight font-bold transition-colors",
                  hot ? "border-foreground bg-foreground text-background" : "border-input bg-card",
                )}
                style={{ left: pct(NODES[i]!.x, 400), top: pct(NODES[i]!.y, 300), transform: "translate(-50%, -50%)" }}
              >
                {d}
              </span>
            );
          })}
        </div>

        <div aria-live="polite" className="lp-st-detail flex flex-col gap-1.5 border-t bg-muted/30 px-4.5 pt-3.5 pb-4.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", KIND[sel.kind].chip)}>{KIND[sel.kind].label}</span>
            <span className="font-bold">
              {ex.drugs[selEnds[0]]} + {ex.drugs[selEnds[1]]}
            </span>
          </div>
          <p className="text-sm text-neutral-ink">{sel.text}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Ví dụ minh hoạ, không thay cho tư vấn y khoa.</p>
    </div>
  );
}
