import type { GraphSeverity } from "@/lib/api";

export interface SeverityMeta {
  id: GraphSeverity;
  label: string;
  /** Edge colour on the dark graph background. */
  color: string;
  /** Classes for a badge on a light card. */
  badge: string;
  /** Text colour on a light card. */
  ink: string;
}

/** DDInter 2.0 risk levels, most serious first. */
export const SEVERITIES: SeverityMeta[] = [
  { id: "major", label: "Nghiêm trọng", color: "#F04438", badge: "bg-sev-major-soft text-sev-major-ink", ink: "text-sev-major" },
  { id: "moderate", label: "Trung bình", color: "#F2A33A", badge: "bg-sev-moderate-soft text-sev-moderate-ink", ink: "text-sev-moderate-ink" },
  { id: "minor", label: "Nhẹ", color: "#5B8DEF", badge: "bg-sev-minor-soft text-sev-minor", ink: "text-sev-minor" },
  { id: "unknown", label: "Chưa rõ", color: "#6B7A88", badge: "bg-neutral-soft text-neutral-ink", ink: "text-neutral-ink" },
];

const BY_ID = new Map(SEVERITIES.map((s) => [s.id, s]));
export const sevOf = (id: GraphSeverity): SeverityMeta => BY_ID.get(id) ?? SEVERITIES[3]!;
export const sevRank = (id: GraphSeverity): number => SEVERITIES.findIndex((s) => s.id === id);
