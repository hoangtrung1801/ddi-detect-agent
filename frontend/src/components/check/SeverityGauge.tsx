import type { OverallRisk } from "@/lib/report";

const SEGMENTS = [
  { label: "Chưa ghi nhận", color: "var(--neutral-stroke)" },
  { label: "Nhẹ", color: "var(--sev-minor)" },
  { label: "Theo dõi", color: "var(--sev-moderate)" },
  { label: "Nghiêm trọng", color: "var(--sev-major)" },
];

/** Needle position (0..1 across the arc) for each overall risk; unknown has no needle. */
const POS: Record<OverallRisk, number | null> = { none: 0.125, low: 0.375, medium: 0.625, high: 0.875, unknown: null };

const R = 70;
const CX = 90;
const CY = 86;
const point = (t: number, r = R): [number, number] => [CX - r * Math.cos(Math.PI * t), CY - r * Math.sin(Math.PI * t)];

/** Half-circle meter: the overall risk at a glance. */
export function SeverityGauge({ risk, label }: { risk: OverallRisk; label: string }) {
  const pos = POS[risk];
  const gap = 0.012;
  return (
    <figure className="flex w-[180px] shrink-0 flex-col items-center" aria-label={`Mức nguy cơ tổng thể: ${label}`}>
      <svg viewBox="0 0 180 100" className="w-full" aria-hidden="true">
        {SEGMENTS.map((s, i) => {
          const [x1, y1] = point(i / 4 + gap);
          const [x2, y2] = point((i + 1) / 4 - gap);
          return <path key={s.label} d={`M${x1} ${y1}A${R} ${R} 0 0 1 ${x2} ${y2}`} fill="none" stroke={s.color} strokeWidth="16" strokeLinecap="butt" opacity={pos === null || Math.floor(pos * 4) === i ? 1 : 0.35} />;
        })}
        {pos !== null ? (
          <g>
            <line x1={CX} y1={CY} x2={point(pos, R - 18)[0]} y2={point(pos, R - 18)[1]} stroke="var(--foreground)" strokeWidth="4" strokeLinecap="round" />
            <circle cx={CX} cy={CY} r="7" fill="var(--foreground)" />
          </g>
        ) : (
          <text x={CX} y={CY - 4} textAnchor="middle" fontSize="30" fontWeight="700" fill="var(--foreground)">
            ?
          </text>
        )}
      </svg>
      <figcaption className="-mt-1 text-sm font-bold">{label}</figcaption>
    </figure>
  );
}
