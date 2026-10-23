import type { Llm } from '../llm/models.ts';
import type { InteractionReport } from '../schemas/report.ts';
import type { ErrorCode } from '../schemas/api.ts';
import { RunContext, type AgentDeps, type Product } from './context.ts';
import { makeBeforeToolCall } from './guard.ts';
import { DDI_PRODUCTS_ADDENDUM, DDI_SYSTEM_PROMPT } from './prompts.ts';
import type { ProgressSink } from './progress.ts';
import { runAgent, type RunStats, type ThinkingLevel } from './run.ts';
import { makeCheckInteractionsTool } from './tools/check-interactions.ts';
import { makeDrugLinksTool } from './tools/drug-links.ts';
import { makeResolveDrugsTool } from './tools/resolve-drugs.ts';
import { makeSubmitReportTool } from './tools/submit-report.ts';

export interface DdiAgentConfig {
  agentModel: string;
  reasoningEffort: ThinkingLevel;
  maxTurns: number;
  queryTimeoutMs: number;
}

export interface AgentFailure {
  code: Extract<ErrorCode, 'AGENT_TIMEOUT' | 'AGENT_NO_REPORT' | 'UPSTREAM_LLM'>;
  message: string;
}

export type DdiResult =
  | { ok: true; report: InteractionReport; stats: RunStats }
  | { ok: false; error: AgentFailure; stats: RunStats };

export interface DdiInput {
  /** Free-text question (any language). */
  text?: string;
  /** Explicit drugs: a name, or a product with the ingredients read from its packaging (checked as ONE drug). */
  drugs?: (string | { name: string; ingredients?: string[] | undefined })[];
}

function toProducts(drugs: NonNullable<DdiInput['drugs']>): Product[] {
  return drugs.map((d) => (typeof d === 'string' ? { name: d, ingredients: [] } : { name: d.name, ingredients: d.ingredients ?? [] }));
}

export function createDdiAgent(deps: AgentDeps & { llm: Llm; config: DdiAgentConfig }) {
  return {
    async run(input: DdiInput, opts: { sink?: ProgressSink; signal?: AbortSignal } = {}): Promise<DdiResult> {
      const products = input.drugs?.length ? toProducts(input.drugs) : [];
      const ctx = new RunContext(deps, opts.sink, products);
      const prompt = ctx.grouped
        ? `Kiểm tra tương tác giữa các thuốc sau. Mỗi mục là MỘT thuốc, kể cả khi gồm nhiều thành phần:\n` +
          products
            .map((p, i) => `${i + 1}. ${p.name}${p.ingredients.length ? ` (thành phần: ${p.ingredients.join('; ')})` : ''}`)
            .join('\n')
        : products.length
          ? `Kiểm tra tương tác giữa các thuốc sau: ${products.map((p) => p.name).join('; ')}`
          : (input.text ?? '');
      const out = await runAgent(
        {
          llm: deps.llm,
          modelId: deps.config.agentModel,
          systemPrompt: ctx.grouped ? DDI_SYSTEM_PROMPT + DDI_PRODUCTS_ADDENDUM : DDI_SYSTEM_PROMPT,
          tools: [makeResolveDrugsTool(ctx), makeCheckInteractionsTool(ctx), makeDrugLinksTool(ctx), makeSubmitReportTool(ctx)],
          thinking: deps.config.reasoningEffort,
          maxTurns: deps.config.maxTurns,
          timeoutMs: deps.config.queryTimeoutMs,
          beforeToolCall: makeBeforeToolCall(ctx),
          ...(opts.sink ? { sink: opts.sink } : {}),
          ...(opts.signal ? { signal: opts.signal } : {}),
        },
        prompt,
      );
      if (ctx.report) return { ok: true, report: ctx.report, stats: out.stats };
      const error: AgentFailure =
        out.stop === 'timeout'
          ? { code: 'AGENT_TIMEOUT', message: `Agent did not finish within ${deps.config.queryTimeoutMs} ms` }
          : out.stop === 'error'
            ? { code: 'UPSTREAM_LLM', message: out.errorMessage ?? 'LLM provider error' }
            : {
                code: 'AGENT_NO_REPORT',
                message:
                  out.stop === 'max_turns'
                    ? `Agent used more than ${deps.config.maxTurns} turns without submitting a report`
                    : 'Agent finished without submitting a report',
              };
      return { ok: false, error, stats: out.stats };
    },
  };
}

export type DdiAgent = ReturnType<typeof createDdiAgent>;
