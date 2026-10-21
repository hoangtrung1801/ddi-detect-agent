import type { Llm } from '../llm/models.ts';
import type { WebSearchFn } from '../llm/web-search.ts';
import type { SessionStore } from '../store/sessions.ts';
import { DEFAULT_SESSION } from '../store/sessions.ts';
import type { InteractionReport } from '../schemas/report.ts';
import { RunContext, type AgentDeps } from './context.ts';
import type { AgentFailure } from './ddi-agent.ts';
import { CHAT_SYSTEM_PROMPT } from './prompts.ts';
import type { ProgressSink } from './progress.ts';
import { runAgent, type RunStats, type ThinkingLevel } from './run.ts';
import { makeCheckInteractionsTool } from './tools/check-interactions.ts';
import { makeDrugLinksTool } from './tools/drug-links.ts';
import { makeResolveDrugsTool } from './tools/resolve-drugs.ts';
import { makeWebSearchTool } from './tools/web-search.ts';

export interface ChatAgentConfig {
  chatModel: string;
  reasoningEffort: ThinkingLevel;
  maxTurns: number;
  queryTimeoutMs: number;
}

export type ChatResult =
  | { ok: true; answer: string; sessionId: string; stats: RunStats }
  | { ok: false; error: AgentFailure; sessionId: string; stats: RunStats };

/** Compact report context appended to the system prompt (links and disclaimer dropped). */
export function reportContext(report: InteractionReport): string {
  const slim = {
    title: report.title,
    overall_risk: report.overall_risk,
    drugs: report.drugs.map((d) => ({ input: d.input, db_name: d.dbName })),
    pairs: report.pairs,
    recommendations: report.recommendations,
  };
  return `\n\nThe user's most recent interaction report (context for follow-up questions):\n<report>${JSON.stringify(slim)}</report>`;
}

export function createChatAgent(deps: AgentDeps & { llm: Llm; sessions: SessionStore; webSearch: WebSearchFn; config: ChatAgentConfig }) {
  return {
    async chat(
      question: string,
      sessionId: string,
      opts: { sink?: ProgressSink; signal?: AbortSignal } = {},
    ): Promise<ChatResult> {
      const { sessions } = deps;
      sessions.ensure(sessionId);
      const history = sessions.getMessages(sessionId);
      // Legacy clients call /query without a session id: fall back to the anonymous slot.
      const report = sessions.getReport(sessionId) ?? sessions.getReport(DEFAULT_SESSION);
      const ctx = new RunContext(deps, opts.sink);
      const out = await runAgent(
        {
          llm: deps.llm,
          modelId: deps.config.chatModel,
          systemPrompt: CHAT_SYSTEM_PROMPT + (report ? reportContext(report) : ''),
          tools: [makeResolveDrugsTool(ctx), makeCheckInteractionsTool(ctx), makeDrugLinksTool(ctx), makeWebSearchTool(deps.webSearch)],
          thinking: deps.config.reasoningEffort,
          maxTurns: deps.config.maxTurns,
          timeoutMs: deps.config.queryTimeoutMs,
          history,
          ...(opts.sink ? { sink: opts.sink } : {}),
          ...(opts.signal ? { signal: opts.signal } : {}),
        },
        question,
      );
      if (out.stop === 'done' && out.finalText.trim()) {
        sessions.saveMessages(sessionId, [...history, ...out.newMessages]);
        return { ok: true, answer: out.finalText.trim(), sessionId, stats: out.stats };
      }
      const error: AgentFailure =
        out.stop === 'timeout'
          ? { code: 'AGENT_TIMEOUT', message: `Chat did not finish within ${deps.config.queryTimeoutMs} ms` }
          : out.stop === 'error'
            ? { code: 'UPSTREAM_LLM', message: out.errorMessage ?? 'LLM provider error' }
            : { code: 'AGENT_NO_REPORT', message: 'Chat finished without an answer' };
      return { ok: false, error, sessionId, stats: out.stats };
    },
  };
}

export type ChatAgent = ReturnType<typeof createChatAgent>;
