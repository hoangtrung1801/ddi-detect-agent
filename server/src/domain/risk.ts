export type Severity = 'major' | 'moderate' | 'minor';
export type PairStatus = 'interaction' | 'no_record' | 'unresolved';
export type OverallRisk = 'high' | 'medium' | 'low' | 'none' | 'unknown';

export interface RiskPair {
  status: PairStatus;
  severity?: Severity | undefined;
  severity_source?: 'DDInter 2.0' | 'model' | undefined;
}

const RANK: Record<OverallRisk, number> = { none: 0, unknown: 0, low: 1, medium: 2, high: 3 };
const FROM_SEVERITY: Record<Severity, OverallRisk> = { minor: 'low', moderate: 'medium', major: 'high' };

/**
 * Overall risk, computed in code.
 * - any interaction: highest known severity; DDInter Unknown stays unknown unless a major risk is known;
 * - no interaction, but some pair is `no_record`/`unresolved`: `unknown` (absence from the database is not safety);
 * - nothing to flag at all (no pairs): `none`.
 */
export function overallRisk(pairs: RiskPair[]): OverallRisk {
  let best: OverallRisk | null = null;
  let unknownSourceRisk = false;
  for (const p of pairs) {
    if (p.status !== 'interaction') continue;
    if (p.severity_source === 'DDInter 2.0' && !p.severity) {
      unknownSourceRisk = true;
      continue;
    }
    const r = p.severity ? FROM_SEVERITY[p.severity] : 'medium';
    if (best === null || RANK[r] > RANK[best]) best = r;
  }
  if (unknownSourceRisk && best !== 'high') return 'unknown';
  if (best) return best;
  if (pairs.some((p) => p.status === 'no_record' || p.status === 'unresolved')) return 'unknown';
  return 'none';
}
