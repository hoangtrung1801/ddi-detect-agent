import type { AgentTool } from '@earendil-works/pi-agent-core';
import { Type } from 'typebox';
import type { RunContext } from '../context.ts';

const Params = Type.Object({
  drugs: Type.Array(Type.String(), { minItems: 1, maxItems: 10, description: 'Database drug names' }),
});

/** Fetch drugs.com links for resolved drugs into the run context. Never throws. */
export async function collectLinks(ctx: RunContext, names: string[]): Promise<Record<string, { url: string; verified: boolean }>> {
  const out: Record<string, { url: string; verified: boolean }> = {};
  await Promise.all(
    names.map(async (n) => {
      if (ctx.links[n]) {
        out[n] = ctx.links[n]!;
        return;
      }
      try {
        const l = await ctx.deps.linkFn(n);
        ctx.links[n] = l;
        out[n] = l;
      } catch {
        /* links are optional */
      }
    }),
  );
  return out;
}

export function makeDrugLinksTool(ctx: RunContext): AgentTool<typeof Params> {
  return {
    name: 'drug_links',
    label: 'Drug links',
    description: 'Get drugs.com reference links for drugs. Optional; call it together with check_interactions.',
    parameters: Params,
    execute: async (_id, params) => {
      const links = await collectLinks(ctx, params.drugs);
      ctx.emit({ type: 'links', links });
      const text = Object.entries(links)
        .map(([n, l]) => `${n}: ${l.url}${l.verified ? '' : ' (unverified)'}`)
        .join('\n');
      return { content: [{ type: 'text', text: text || 'No links available.' }], details: links };
    },
  };
}
