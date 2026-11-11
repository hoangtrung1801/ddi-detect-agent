import type { LinkInfo } from '../domain/links.ts';
import type { ResolvedDrug } from '../domain/resolver.ts';
import type { EvidenceSource } from '../schemas/report.ts';
import type { PairResult } from './context.ts';

export type ProgressEvent =
  | { type: 'turn'; n: number }
  | { type: 'tool_start'; tool: string; args: unknown }
  | { type: 'tool_end'; tool: string; ok: boolean; ms: number }
  | { type: 'resolved'; drugs: ResolvedDrug[] }
  | { type: 'pairs'; pairs: PairResult[] }
  | { type: 'links'; links: Record<string, LinkInfo> }
  /** Source documents read for the interactions (DDInter pages and FDA labels; literature is not listed). */
  | { type: 'evidence'; sources: EvidenceSource[] };

export type ProgressSink = (e: ProgressEvent) => void;
