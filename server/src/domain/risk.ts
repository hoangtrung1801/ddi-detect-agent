export type Severity = 'major' | 'moderate' | 'minor';
export type PairStatus = 'interaction' | 'no_record' | 'unresolved';
export type OverallRisk = 'high' | 'medium' | 'low' | 'none' | 'unknown';

export interface RiskPair {
  status: PairStatus;
  severity?: Severity | undefined;
}

const RANK: Record<OverallRisk, number> = { none: 0, unknown: 0, low: 1, medium: 2, high: 3 };
const FROM_SEVERITY: Record<Severity, OverallRisk> = { minor: 'low', moderate: 'medium', major: 'high' };

/**
 * Overall risk, computed in code.
 * - any `interaction` pair: the highest model-assigned severity (missing severity counts as medium);
 * - no interaction, but some pair is `no_record`/`unresolved`: `unknown` (absence from the database is not safety);
 * - nothing to flag at all (no pairs): `none`.
 */
export function overallRisk(pairs: RiskPair[]): OverallRisk {
  let best: OverallRisk | null = null;
  for (const p of pairs) {
    if (p.status !== 'interaction') continue;
    const r = p.severity ? FROM_SEVERITY[p.severity] : 'medium';
    if (best === null || RANK[r] > RANK[best]) best = r;
  }
  if (best) return best;
  if (pairs.some((p) => p.status === 'no_record' || p.status === 'unresolved')) return 'unknown';
  return 'none';
}
