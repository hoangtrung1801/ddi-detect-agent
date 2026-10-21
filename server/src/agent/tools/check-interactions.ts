import type { AgentTool } from '@earendil-works/pi-agent-core';
import { Type } from 'typebox';
import { computePairs, type PairResult, type RunContext } from '../context.ts';

const Params = Type.Object({
  drugs: Type.Array(Type.String(), {
    minItems: 0,
    maxItems: 10,
    description:
      'Database drug names returned by resolve_drugs (all resolved drugs of the request; may be fewer than two or empty when drugs could not be resolved, unresolved drugs are added automatically)',
  }),
});

export function formatPair(p: PairResult): string {
  if (p.status === 'interaction') return `INTERACTION  ${p.a} + ${p.b}: ${p.condition}`;
  if (p.status === 'no_record') return `NO_RECORD  ${p.a} + ${p.b}: no interaction is recorded in the database (this does not prove it is safe)`;
  return `UNRESOLVED  ${p.a} + ${p.b}: at least one drug could not be matched to the database, so this pair was not checked`;
}

export function makeCheckInteractionsTool(ctx: RunContext): AgentTool<typeof Params> {
  return {
    name: 'check_interactions',
    label: 'Check interactions',
    description:
      'Look up every pair of the request\'s drugs in the interaction database in one call. Statuses are decided by the database, not by you.',
    parameters: Params,
    execute: async (_id, params) => {
      const unknown: string[] = [];
      for (const name of params.drugs) {
        const d = ctx.deps.drugDb.getDrug(name);
        if (!d) {
          unknown.push(name);
          continue;
        }
        // A DB name the model passed that resolve_drugs never saw: register it as an exact match.
        ctx.addResolved({ input: d.name, generic: d.name, dbName: d.name, confidence: 1, method: 'exact', alternatives: [] });
      }
      if (unknown.length) {
        throw new Error(
          `Not database drug names: ${unknown.join(', ')}. Call resolve_drugs first and pass the resolved database names (skip unresolved drugs).`,
        );
      }
      const pairs = computePairs(ctx);
      if (pairs.length === 0) throw new Error('At least two distinct drugs are needed to check interactions.');
      ctx.pairs = pairs;
      ctx.emit({ type: 'pairs', pairs });
      return {
        content: [{ type: 'text', text: pairs.map(formatPair).join('\n') }],
        details: pairs,
      };
    },
  };
}
