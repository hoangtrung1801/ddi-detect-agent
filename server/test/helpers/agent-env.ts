import { fauxAssistantMessage, fauxToolCall, type FauxResponseStep } from '@earendil-works/pi-ai';
import { createDdiAgent } from '../../src/agent/ddi-agent.ts';
import type { ProgressEvent } from '../../src/agent/progress.ts';
import { slugify } from '../../src/domain/links.ts';
import { makeDomain } from './domain.ts';
import { makeFauxLlm } from './faux-llm.ts';

export async function makeAgentEnv(over: { maxTurns?: number; queryTimeoutMs?: number; resolveMin?: number } = {}) {
  const dom = await makeDomain(over.resolveMin !== undefined ? { resolveMin: over.resolveMin } : {});
  const f = makeFauxLlm();
  const events: ProgressEvent[] = [];
  const agent = createDdiAgent({
    drugDb: dom.drugDb,
    resolver: dom.resolver,
    linkFn: async (n) => ({ url: `https://www.drugs.com/${slugify(n)}.html`, verified: true }),
    llm: f.llm,
    config: {
      agentModel: 'faux-1',
      reasoningEffort: 'off',
      maxTurns: over.maxTurns ?? 6,
      queryTimeoutMs: over.queryTimeoutMs ?? 5000,
    },
  });
  return { ...dom, ...f, agent, events, sink: (e: ProgressEvent) => void events.push(e) };
}

export const call = (name: string, args: Record<string, unknown>) =>
  fauxAssistantMessage([fauxToolCall(name, args as any)], { stopReason: 'toolUse' });

export const script = (...steps: FauxResponseStep[]) => steps;
