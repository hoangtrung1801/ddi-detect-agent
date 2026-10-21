import type { LinkInfo } from '../domain/links.ts';
import type { ResolvedDrug } from '../domain/resolver.ts';
import type { PairResult } from './context.ts';

export type ProgressEvent =
  | { type: 'turn'; n: number }
  | { type: 'tool_start'; tool: string; args: unknown }
  | { type: 'tool_end'; tool: string; ok: boolean; ms: number }
  | { type: 'resolved'; drugs: ResolvedDrug[] }
  | { type: 'pairs'; pairs: PairResult[] }
  | { type: 'links'; links: Record<string, LinkInfo> };

export type ProgressSink = (e: ProgressEvent) => void;
