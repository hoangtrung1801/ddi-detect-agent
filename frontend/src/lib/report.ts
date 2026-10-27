// Types mirror the server's v2 InteractionReport (ai/server/src/schemas/report.ts).

export type Severity = "major" | "moderate" | "minor";
export type PairStatus = "interaction" | "no_record" | "unresolved";
export type OverallRisk = "high" | "medium" | "low" | "none" | "unknown";

export interface ResolvedIngredient {
  input: string;
  generic: string;
  dbName: string | null;
  confidence: number;
  method: "exact" | "alias" | "vector" | "none";
  alternatives: { name: string; score: number }[];
}

/** For a multi-ingredient product, `input` is the product name and `ingredients` has each ingredient's resolution. */
export interface ResolvedDrug extends ResolvedIngredient {
  ingredients?: ResolvedIngredient[];
}

export interface IngredientPair {
  a: string;
  b: string;
  condition: string;
}

export interface InteractionDetail {
  pageId: number;
  drugAId: string;
  drugBId: string;
  drugAName: string;
  drugBName: string;
  level: "Major" | "Moderate" | "Minor" | "Unknown";
  mechanisms: string[];
  description: string | null;
  management: string | null;
  references: string[];
  url: string;
  retrievedAt: string;
  sha256: string;
}

export interface SourceInteractionRecord {
  source: "DDInter 2.0";
  drugAId: string;
  drugBId: string;
  level: string;
  url: string;
  details?: InteractionDetail[];
}

export interface ReportPair {
  a: string;
  b: string;
  status: PairStatus;
  severity?: Severity;
  db_condition?: string;
  severity_source?: "DDInter 2.0" | "model";
  source_records?: SourceInteractionRecord[];
  /** Pairs involving a multi-ingredient product: the ingredient pairs the database records. */
  ingredient_pairs?: IngredientPair[];
  explanation: string;
}

/** Reference page for a drug. Long Châu is preferred, then drugs.com, then a generic drugs.com search. */
export interface LinkInfo {
  url: string;
  verified: boolean;
  source?: "longchau" | "drugs.com" | "drugs.com-search";
  title?: string;
}

const LINK_SOURCE_LABEL: Record<NonNullable<LinkInfo["source"]>, string> = {
  longchau: "Nhà thuốc Long Châu",
  "drugs.com": "Drugs.com",
  "drugs.com-search": "Tìm trên Drugs.com",
};

export function linkSourceLabel(l: LinkInfo): string {
  return LINK_SOURCE_LABEL[l.source ?? "drugs.com"];
}

/** Long Châu first, then specific drugs.com pages, then generic searches. */
export function linkPriority(l: LinkInfo): number {
  return l.source === "longchau" ? 0 : l.source === "drugs.com-search" ? 2 : 1;
}

export interface InteractionReport {
  title: string;
  drugs: ResolvedDrug[];
  pairs: ReportPair[];
  overall_risk: OverallRisk;
  recommendations: string[];
  links: Record<string, LinkInfo>;
  disclaimer: string;
}

/** Pair results sent mid-run, before the model has written explanations or severities. */
export interface PairResult {
  a: string;
  b: string;
  status: PairStatus;
  condition?: string;
  sourceSeverity?: Severity;
  sourceRecords?: SourceInteractionRecord[];
}

export type ProgressEvent =
  | { type: "turn"; n: number }
  | { type: "tool_start"; tool: string; args: unknown }
  | { type: "tool_end"; tool: string; ok: boolean; ms: number }
  | { type: "resolved"; drugs: ResolvedDrug[] }
  | { type: "pairs"; pairs: PairResult[] }
  | { type: "links"; links: Record<string, LinkInfo> };

/** One visual category per pair: interaction severities plus the two "unknown" states. */
export type PairKind = Severity | "unknown" | "no_record" | "unresolved";

export const KIND_ORDER: PairKind[] = ["major", "unknown", "moderate", "minor", "no_record", "unresolved"];

export interface KindMeta {
  label: string;
  /** Plain-language answer to "can I take these together?". */
  answer: string;
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
    answer: "Không nên dùng chung",
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
    answer: "Dùng được nếu theo dõi",
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
    answer: "Thường dùng được, lưu ý nhẹ",
    short: "Nhẹ",
    badge: "bg-sev-minor-soft text-sev-minor border border-sev-minor/50",
    soft: "bg-sev-minor-soft text-sev-minor border border-sev-minor/30",
    fill: "bg-sev-minor",
    stroke: "var(--color-sev-minor)",
    width: 3,
    dashed: false,
    level: 1,
  },
  unknown: {
    label: "Có tương tác · chưa rõ mức độ",
    answer: "Có tương tác, chưa rõ mức độ",
    short: "Chưa rõ mức độ",
    badge: "bg-neutral-soft text-neutral-ink border border-neutral-line",
    soft: "bg-neutral-soft text-neutral-ink border border-neutral-line",
    fill: "bg-neutral-soft border border-neutral-line",
    stroke: "var(--color-neutral-stroke)",
    width: 3,
    dashed: true,
    level: null,
  },
  no_record: {
    label: "Chưa có dữ liệu",
    answer: "Không có ghi nhận tương tác",
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
    answer: "Chưa tra được",
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
  return p.severity ?? "unknown";
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
