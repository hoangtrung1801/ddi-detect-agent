import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { KIND_META, linkPriority, linkSourceLabel, type LinkInfo } from "@/lib/report";
import type { DisplayPair } from "./types";

interface PairDetailProps {
  pair: DisplayPair;
  index: number;
  total: number;
  links: Record<string, LinkInfo>;
  onPrev: () => void;
  onNext: () => void;
  onFixDrug?: () => void;
}

/** Splits the explanation into a short "what happens" line (its first sentence) and the rest. */
function splitExplanation(p: DisplayPair): { headline: string; rest: string } {
  if (p.status === "no_record") return { headline: "Chưa ghi nhận trong cơ sở dữ liệu", rest: p.explanation ?? "" };
  if (p.status === "unresolved") return { headline: "Chưa tra cứu được", rest: p.explanation ?? "" };
  if (p.pending || !p.explanation) return { headline: "Có tương tác — đang đánh giá mức độ", rest: "" };
  const [first = p.explanation, ...rest] = p.explanation.split(/(?<=[.!?])\s+/);
  return { headline: first.replace(/[.]$/, ""), rest: rest.join(" ") };
}

export function PairDetail({ pair, index, total, links, onPrev, onNext, onFixDrug }: PairDetailProps) {
  const meta = KIND_META[pair.kind];
  const pendingInteraction = pair.pending && pair.status === "interaction";
  const ingredientPairs = pair.ingredientPairs ?? [];
  // Links are keyed by database name: the drugs themselves, or the interacting ingredients of a product.
  const sources = [...new Set([pair.a, pair.b, ...ingredientPairs.flatMap((i) => [i.a, i.b])])]
    .filter((d) => links[d])
    .sort((x, y) => linkPriority(links[x]!) - linkPriority(links[y]!));
  const { headline, rest } = splitExplanation(pair);

  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", pendingInteraction ? "bg-foreground text-background" : meta.badge)}>
            {pendingInteraction ? "Có tương tác" : meta.label}
          </span>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {index + 1}/{total}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon-lg" className="size-11 bg-card" onClick={onPrev} aria-label="Cặp trước">
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button variant="outline" size="icon-lg" className="size-11 bg-card" onClick={onNext} aria-label="Cặp tiếp theo">
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>
        <h3 className="text-lg font-bold">
          {pair.a} + {pair.b}
        </h3>
      </div>

      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <span className="rounded-lg border border-input bg-card px-3 py-1.5 font-semibold">{pair.a}</span>
        <span aria-hidden="true" className="text-lg text-muted-foreground">
          +
        </span>
        <span className="rounded-lg border border-input bg-card px-3 py-1.5 font-semibold">{pair.b}</span>
        <span className="flex min-w-0 basis-full items-center gap-2.5 sm:basis-auto">
          <ArrowRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className={cn("rounded-lg px-3 py-1.5 font-bold", meta.soft)}>
            {pendingInteraction && <Loader2 className="mr-1.5 inline size-4 animate-spin" aria-hidden="true" />}
            {headline}
          </span>
        </span>
      </div>

      {meta.level !== null && !pair.pending && (
        <div className="flex max-w-[360px] flex-col gap-1.5">
          <div className="text-xs font-semibold text-neutral-ink">Mức độ</div>
          <div className="grid grid-cols-3 gap-1" role="img" aria-label={`Mức độ: ${meta.label}`}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={cn("h-2 rounded-full", i <= meta.level! ? meta.fill : "bg-border")} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1 text-xs text-muted-foreground">
            <span>Nhẹ</span>
            <span>Vừa</span>
            <span>Nặng</span>
          </div>
        </div>
      )}

      {rest && !pair.pending && <p className="max-w-[72ch] leading-relaxed">{rest}</p>}
      {pair.status === "no_record" && (
        <p className="max-w-[72ch] text-sm font-semibold text-neutral-ink">
          Không có dữ liệu không có nghĩa là an toàn — hãy hỏi dược sĩ nếu dùng chung lâu ngày.
        </p>
      )}
      {ingredientPairs.length > 0 && !pair.pending && (
        <div className="flex max-w-[72ch] flex-col gap-1.5">
          <div className="text-xs font-semibold text-neutral-ink">Thành phần liên quan ({ingredientPairs.length})</div>
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
      {pair.dbCondition && ingredientPairs.length === 0 && (
        <p className="max-w-[72ch] text-xs text-muted-foreground">
          <span className="font-semibold">Mô tả gốc trong cơ sở dữ liệu:</span> <span lang="en">{pair.dbCondition}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {sources.map((d) => (
          <a key={d} href={links[d]!.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            Thông tin về {d}
            <span className="font-normal text-muted-foreground">· {linkSourceLabel(links[d]!)}</span>
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        ))}
        {pair.status === "unresolved" && onFixDrug && (
          <Button variant="outline" className="h-11 bg-card" onClick={onFixDrug}>
            Sửa tên thuốc
          </Button>
        )}
      </div>
    </div>
  );
}
