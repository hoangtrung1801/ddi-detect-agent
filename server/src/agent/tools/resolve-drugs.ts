import type { AgentTool } from '@earendil-works/pi-agent-core';
import { Type } from 'typebox';
import type { RunContext } from '../context.ts';

const Params = Type.Object({
  drugs: Type.Array(
    Type.Object({
      input: Type.String({ description: 'Drug name exactly as the user wrote it (brand, misspelling, any language)' }),
      generic_guess: Type.Optional(
        Type.String({ description: 'Your best guess of the generic / active ingredient name in English (e.g. Tylenol -> acetaminophen)' }),
      ),
    }),
    { minItems: 1, maxItems: 10 },
  ),
});

export function makeResolveDrugsTool(ctx: RunContext): AgentTool<typeof Params> {
  return {
    name: 'resolve_drugs',
    label: 'Resolve drug names',
    description:
      'Map every drug the user mentioned to its name in the interaction database. Always call this first, with all drugs at once. ' +
      'Provide generic_guess whenever the input is a brand name, abbreviation, misspelling or non-English name.',
    parameters: Params,
    execute: async (_id, params) => {
      const resolved = await Promise.all(params.drugs.map((d) => ctx.deps.resolver.resolve(d.input, d.generic_guess)));
      resolved.forEach((r) => ctx.addResolved(r));
      ctx.emit({ type: 'resolved', drugs: resolved });
      const lines = resolved.map((r, i) =>
        r.dbName
          ? `${i + 1}. "${r.input}" -> ${r.dbName} (${r.method}, confidence ${r.confidence})`
          : `${i + 1}. "${r.input}" -> UNRESOLVED (not matched in the database` +
            (r.alternatives.length ? `; closest, NOT accepted: ${r.alternatives.map((a) => `${a.name} ${a.score}`).join(', ')}` : '') +
            ')',
      );
      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        details: resolved,
      };
    },
  };
}
