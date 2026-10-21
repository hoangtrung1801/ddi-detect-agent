// Types mirror the server's v2 InteractionReport (ai/server/src/schemas/report.ts).

export type Severity = "major" | "moderate" | "minor";
export type PairStatus = "interaction" | "no_record" | "unresolved";
export type OverallRisk = "high" | "medium" | "low" | "none" | "unknown";

export interface ResolvedDrug {
  input: string;
  generic: string;
  dbName: string | null;
  confidence: number;
  method: "exact" | "alias" | "vector" | "none";
  alternatives: { name: string; score: number }[];
}

export interface ReportPair {
  a: string;
  b: string;
  status: PairStatus;
  severity?: Severity;
  db_condition?: string;
  explanation: string;
}

export interface InteractionReport {
  title: string;
  drugs: ResolvedDrug[];
  pairs: ReportPair[];
  overall_risk: OverallRisk;
  recommendations: string[];
  links: Record<string, { url: string; verified: boolean }>;
  disclaimer: string;
}

/** Pair results sent mid-run, before the model has written explanations or severities. */
export interface PairResult {
  a: string;
  b: string;
  status: PairStatus;
  condition?: string;
}

export type ProgressEvent =
  | { type: "turn"; n: number }
  | { type: "tool_start"; tool: string; args: unknown }
  | { type: "tool_end"; tool: string; ok: boolean; ms: number }
  | { type: "resolved"; drugs: ResolvedDrug[] }
  | { type: "pairs"; pairs: PairResult[] }
  | { type: "links"; links: Record<string, { url: string; verified: boolean }> };

/** One visual category per pair: interaction severities plus the two "unknown" states. */
export type PairKind = Severity | "no_record" | "unresolved";

export const KIND_ORDER: PairKind[] = ["major", "moderate", "minor", "no_record", "unresolved"];

export interface KindMeta {
  label: string;
  short: string;
  /** Badge / chip classes. */
  badge: string;
  /** Soft background for effect boxes. */
  soft: string;
  /** Solid fill for meters and swatches. */
  fill: string;
  /** SVG stroke colour and base width for the map. */
  stroke: string;
  width: number;
  dashed: boolean;
  /** Number of filled segments on the 3-step severity meter, or null for no meter. */
  level: number | null;
}

export const KIND_META: Record<PairKind, KindMeta> = {
  major: {
    label: "Nghiêm trọng",
    short: "Nặng",
    badge: "bg-sev-major text-white border border-sev-major",
    soft: "bg-sev-major-soft text-sev-major-ink border border-sev-major/30",
    fill: "bg-sev-major",
    stroke: "var(--color-sev-major)",
    width: 6,
    dashed: false,
    level: 3,
  },
  moderate: {
    label: "Trung bình",
    short: "Vừa",
    badge: "bg-sev-moderate text-sev-moderate-ink border border-sev-moderate",
    soft: "bg-sev-moderate-soft text-sev-moderate-ink border border-sev-moderate/40",
    fill: "bg-sev-moderate",
    stroke: "var(--color-sev-moderate)",
    width: 4,
    dashed: false,
    level: 2,
  },
  minor: {
    label: "Nhẹ",
    short: "Nhẹ",
    badge: "bg-sev-minor-soft text-sev-minor border border-sev-minor/50",
    soft: "bg-sev-minor-soft text-sev-minor border border-sev-minor/30",
    fill: "bg-sev-minor",
    stroke: "var(--color-sev-minor)",
    width: 3,
    dashed: false,
    level: 1,
  },
  no_record: {
    label: "Chưa có dữ liệu",
    short: "Chưa có DL",
    badge: "bg-neutral-soft text-neutral-ink border border-neutral-line",
    soft: "bg-neutral-soft text-neutral-ink border border-neutral-line",
    fill: "bg-neutral-soft border border-neutral-line",
    stroke: "var(--color-neutral-stroke)",
    width: 2.5,
    dashed: false,
    level: null,
  },
  unresolved: {
    label: "Không xác định",
    short: "?",
    badge: "bg-card text-muted-foreground border border-dashed border-neutral-stroke",
    soft: "bg-card text-neutral-ink border border-dashed border-neutral-stroke",
    fill: "bg-card border border-dashed border-neutral-stroke",
    stroke: "var(--color-neutral-stroke)",
    width: 1.5,
    dashed: true,
    level: null,
  },
};

export function pairKind(p: { status: PairStatus; severity?: Severity }): PairKind {
  if (p.status !== "interaction") return p.status;
  // The server scores a missing severity as medium risk; show it the same way.
  return p.severity ?? "moderate";
}

export function pairId(p: { a: string; b: string }): string {
  return `${p.a}\u0000${p.b}`;
}

export function sortPairs<T extends { status: PairStatus; severity?: Severity }>(pairs: T[]): T[] {
  return [...pairs].sort((x, y) => KIND_ORDER.indexOf(pairKind(x)) - KIND_ORDER.indexOf(pairKind(y)));
}

export function drugLabel(d: ResolvedDrug): string {
  return d.dbName ?? d.input;
}

export interface RiskMeta {
  label: string;
  /** Position on the 4-step gauge (0 none … 3 high), or null for unknown. */
  step: number | null;
  panel: string;
  title: string;
  icon: "alert" | "info" | "check";
}

export const RISK_META: Record<OverallRisk, RiskMeta> = {
  high: { label: "Nguy cơ cao", step: 3, panel: "bg-sev-major-soft border-sev-major/30", title: "text-sev-major-ink", icon: "alert" },
  medium: { label: "Nguy cơ trung bình", step: 2, panel: "bg-sev-moderate-soft border-sev-moderate/40", title: "text-sev-moderate-ink", icon: "alert" },
  low: { label: "Nguy cơ thấp", step: 1, panel: "bg-sev-minor-soft border-sev-minor/30", title: "text-sev-minor", icon: "info" },
  // "none" only when every pair was checked and none has a record — still not a safety guarantee.
  none: { label: "Chưa ghi nhận tương tác", step: 0, panel: "bg-neutral-soft border-neutral-line", title: "text-neutral-ink", icon: "check" },
  unknown: { label: "Chưa đủ dữ liệu", step: null, panel: "bg-neutral-soft border-neutral-line", title: "text-neutral-ink", icon: "info" },
};
