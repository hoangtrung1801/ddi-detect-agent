import { cn } from "@/lib/utils";
import { ORGAN_LABEL, type Organ, type PairAnalysis } from "@/lib/report";
import { Cite } from "./Evidence";

/** Organ shapes on a 200×400 figure, with where each organ's number marker sits. */
const ORGANS: Record<Exclude<Organ, "other" | "skin" | "blood">, { d: string; at: [number, number] }> = {
  brain: { d: "M82 34a18 13 0 1 0 36 0a18 13 0 1 0 -36 0Z", at: [130, 26] },
  eye: { d: "M88.5 47a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0ZM104.5 47a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0Z", at: [130, 50] },
  lungs: { d: "M73 112a13 22 0 1 0 26 0a13 22 0 1 0 -26 0ZM101 112a13 22 0 1 0 26 0a13 22 0 1 0 -26 0Z", at: [60, 100] },
  heart: { d: "M104 134C90 124 94 108 104 115C114 108 118 124 104 134Z", at: [140, 118] },
  liver: { d: "M70 150Q90 140 106 150Q100 168 76 165Z", at: [56, 152] },
  gi: { d: "M108 147Q128 144 127 164Q119 176 106 168ZM80 186h40a6 6 0 0 1 6 6v22a6 6 0 0 1 -6 6h-40a6 6 0 0 1 -6 -6v-22a6 6 0 0 1 6 -6Z", at: [144, 168] },
  kidney: { d: "M66 174a6 10 0 1 0 12 0a6 10 0 1 0 -12 0ZM122 174a6 10 0 1 0 12 0a6 10 0 1 0 -12 0Z", at: [56, 186] },
  muscle: { d: "M73 272a10 30 0 1 0 20 0a10 30 0 1 0 -20 0ZM107 272a10 30 0 1 0 20 0a10 30 0 1 0 -20 0Z", at: [140, 272] },
};

const SILHOUETTE =
  "M100 16a24 24 0 1 1 0 48a24 24 0 1 1 0-48Z M92 62h16v14H92Z M64 78Q100 70 136 78L144 150Q140 200 132 236H68Q60 200 56 150Z " +
  "M60 82l-16 4-10 128a8 8 0 0 0 15 2l15-110Z M140 82l16 4 10 128a8 8 0 0 1-15 2l-15-110Z M70 230h28v150a12 12 0 0 1-24 0Z M102 230h28l-4 150a12 12 0 0 1-24 0Z";

const VESSELS = "M100 76V232 M72 88L46 210 M128 88L154 210 M86 236V376 M114 236V376";

/** Where in the body the harm shows up: affected organs lit on a figure, numbered to the consequence list beside it. */
export function BodyMap({ consequences, severe, animate = true }: { consequences: PairAnalysis["consequences"]; severe: boolean; animate?: boolean }) {
  if (!consequences.length) return null;
  const organs = [...new Set(consequences.map((c) => c.organ))];
  const num = (o: Organ) => organs.indexOf(o) + 1;
  const color = severe ? "var(--sev-major)" : "var(--sev-moderate)";
  const has = (o: Organ) => organs.includes(o);

  return (
    <div className="flex flex-wrap items-start gap-3 rounded-xl border bg-card px-3 py-3.5 sm:gap-4 sm:px-3.5">
      <svg viewBox="0 0 200 400" className="h-[200px] w-[100px] shrink-0 sm:h-[300px] sm:w-[150px]" role="img" aria-label={`Cơ quan bị ảnh hưởng: ${organs.map((o) => ORGAN_LABEL[o]).join(", ")}`}>
        <path d={SILHOUETTE} fill="var(--muted)" stroke={has("skin") ? color : "var(--neutral-stroke)"} strokeWidth={has("skin") ? 3 : 1} strokeOpacity={has("skin") ? 1 : 0.5} />
        <path d={VESSELS} fill="none" stroke={has("blood") ? color : "transparent"} strokeWidth="3" strokeLinecap="round" strokeDasharray={has("blood") ? "0" : undefined} opacity={0.85}>
          {animate && has("blood") && <animate attributeName="opacity" values="0.45;1;0.45" dur="1.8s" repeatCount="indefinite" />}
        </path>
        {(Object.keys(ORGANS) as (keyof typeof ORGANS)[]).map((o) => (
          <path key={o} d={ORGANS[o].d} fill={has(o) ? color : "var(--card)"} stroke={has(o) ? color : "var(--neutral-stroke)"} strokeWidth="1.2" strokeOpacity={has(o) ? 1 : 0.45}>
            {animate && has(o) && <animate attributeName="fill-opacity" values="0.55;1;0.55" dur="1.8s" repeatCount="indefinite" />}
          </path>
        ))}
        {organs.map((o) => {
          const at: [number, number] | undefined = o === "blood" ? [40, 230] : o === "skin" ? [160, 330] : o === "other" ? undefined : ORGANS[o].at;
          if (!at) return null;
          return (
            <g key={o}>
              <circle cx={at[0]} cy={at[1]} r="10" fill="var(--foreground)" />
              <text x={at[0]} y={at[1] + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--card)">
                {num(o)}
              </text>
            </g>
          );
        })}
      </svg>
      <ol className="flex min-w-[150px] flex-1 flex-col gap-2.5">
        {organs.map((o) => (
          <li key={o} className="flex gap-2.5">
            <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">{num(o)}</span>
            <div className="flex min-w-0 flex-col gap-1">
              <span className={cn("text-xs font-bold tracking-wide uppercase", severe ? "text-sev-major-ink" : "text-sev-moderate-ink")}>{ORGAN_LABEL[o]}</span>
              <ul className="flex flex-col gap-1 text-sm leading-snug">
                {consequences
                  .filter((c) => c.organ === o)
                  .map((c) => (
                    <li key={c.text}>
                      {c.urgent && <span className="mr-1.5 rounded bg-sev-major px-1.5 py-px text-[11px] font-bold text-white">Cấp cứu</span>}
                      {c.text}
                      <Cite ids={c.sources} />
                    </li>
                  ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
