import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { KIND_META } from "@/lib/report";
import type { DisplayDrug, DisplayPair } from "./types";

interface Frame {
  w: number;
  h: number;
  /** Ellipse radii for up to 4 drugs, and for more. */
  small: [number, number];
  large: [number, number];
  chipGap: number;
}

const WIDE: Frame = { w: 600, h: 340, small: [190, 118], large: [215, 125], chipGap: 56 };
// Phones get a taller frame so nodes and chips do not collide.
const NARROW: Frame = { w: 360, h: 380, small: [150, 165], large: [140, 150], chipGap: 44 };
const NARROW_BELOW = 520;

interface InteractionMapProps {
  drugs: DisplayDrug[];
  pairs: DisplayPair[];
  selectedId: string | null;
  focus: string | null;
  isVisible: (p: DisplayPair) => boolean;
  onSelectPair: (id: string) => void;
  onToggleFocus: (label: string) => void;
}

function nodePositions(n: number, f: Frame): { x: number; y: number }[] {
  if (n === 1) return [{ x: f.w / 2, y: f.h / 2 }];
  if (n === 2) return [{ x: f.w / 4, y: f.h / 2 }, { x: (3 * f.w) / 4, y: f.h / 2 }];
  const [rx, ry] = n <= 4 ? f.small : f.large;
  // Start so that even counts get a flat top edge.
  const start = -Math.PI / 2 - Math.PI / n;
  return Array.from({ length: n }, (_, i) => {
    const t = start + (2 * Math.PI * i) / n;
    return { x: f.w / 2 + rx * Math.cos(t), y: f.h / 2 + ry * Math.sin(t) };
  });
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(() => (typeof window === "undefined" ? 1024 : window.innerWidth));
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Drug-pair map: nodes are drugs, lines are pairs; heavier lines mean more serious interactions. */
export function InteractionMap({ drugs, pairs, selectedId, focus, isVisible, onSelectPair, onToggleFocus }: InteractionMapProps) {
  const [boxRef, width] = useWidth();
  const frame = width < NARROW_BELOW ? NARROW : WIDE;
  const { w: W, h: H } = frame;

  const layout = useMemo(() => {
    const pos = nodePositions(drugs.length, frame);
    const at = new Map(drugs.map((d, i) => [d.label, pos[i]!]));
    const showNoRecordChips = drugs.length <= 4;
    const placed: { x: number; y: number }[] = [...pos];
    const edges = pairs.flatMap((p) => {
      const a = at.get(p.a);
      const b = at.get(p.b);
      if (!a || !b) return [];
      const wantsChip = p.status === "interaction" || (p.status === "no_record" && showNoRecordChips);
      let chip: { x: number; y: number } | null = null;
      if (wantsChip) {
        // Midpoint first, then slide along the line to avoid sitting on another chip or node.
        for (const t of [0.5, 0.36, 0.64, 0.26, 0.74]) {
          const c = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
          if (placed.every((o) => Math.hypot(o.x - c.x, o.y - c.y) >= frame.chipGap)) {
            chip = c;
            break;
          }
        }
        chip ??= { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        placed.push(chip);
      }
      return [{ p, a, b, chip }];
    });
    return { pos, edges };
  }, [drugs, pairs, frame]);

  const pct = (v: number, of: number) => `${(v / of) * 100}%`;

  return (
    <div ref={boxRef} className="relative mx-auto w-full max-w-[640px]" style={{ aspectRatio: `${W} / ${H}` }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
        {layout.edges.map(({ p, a, b }) => {
          const meta = KIND_META[p.kind];
          const selected = p.id === selectedId;
          const visible = isVisible(p);
          return (
            <g key={p.id}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={p.pending && p.status === "interaction" ? "var(--color-foreground)" : meta.stroke}
                strokeWidth={meta.width + (selected ? 3 : 0)}
                strokeDasharray={meta.dashed ? "6 6" : undefined}
                strokeLinecap="round"
                strokeOpacity={visible ? 1 : 0.15}
                className="transition-all duration-300"
              />
              {/* Wide invisible hit area so the line itself is easy to click. */}
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="transparent"
                strokeWidth={18}
                className="cursor-pointer"
                style={{ pointerEvents: "stroke" }}
                onClick={() => onSelectPair(p.id)}
              />
            </g>
          );
        })}
      </svg>

      {layout.edges.map(({ p, chip }) => {
        if (!chip) return null;
        const meta = KIND_META[p.kind];
        const selected = p.id === selectedId;
        const label = p.pending && p.status === "interaction" ? "Có tương tác" : meta.short;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelectPair(p.id)}
            aria-label={`${p.a} và ${p.b}: ${p.pending && p.status === "interaction" ? "có tương tác, đang đánh giá" : meta.label}`}
            aria-pressed={selected}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap transition-all duration-300 sm:px-3 sm:text-xs",
              p.pending && p.status === "interaction" ? "bg-foreground text-background" : meta.badge,
              selected && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
              !isVisible(p) && "opacity-20",
            )}
            style={{ left: pct(chip.x, W), top: pct(chip.y, H) }}
          >
            {label}
          </button>
        );
      })}

      {drugs.map((d, i) => {
        const pos = layout.pos[i]!;
        const on = focus === d.label;
        return (
          <button
            key={d.label}
            type="button"
            onClick={() => onToggleFocus(d.label)}
            aria-pressed={on}
            title={d.input !== d.label ? `Bạn nhập “${d.input}”` : undefined}
            className={cn(
              "absolute flex min-h-10 w-[31%] max-w-[150px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border-[1.5px] px-2 py-1.5 text-center text-xs leading-tight font-bold transition-colors sm:min-h-12 sm:text-sm",
              on
                ? "border-foreground bg-foreground text-background"
                : d.resolved
                  ? "border-input bg-card text-foreground hover:border-foreground"
                  : "border-dashed border-neutral-stroke bg-muted text-muted-foreground hover:border-foreground",
            )}
            style={{ left: pct(pos.x, W), top: pct(pos.y, H) }}
          >
            <span className={cn("line-clamp-2", d.label.length > 11 && "text-[11px] sm:text-xs")}>{d.label}</span>
          </button>
        );
      })}
    </div>
  );
}
