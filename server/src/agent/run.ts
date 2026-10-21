import { Agent, type AgentEvent, type AgentMessage, type AgentTool, type BeforeToolCallContext, type BeforeToolCallResult } from '@earendil-works/pi-agent-core';
import type { AssistantMessage, ImageContent } from '@earendil-works/pi-ai';
import type { Llm } from '../llm/models.ts';
import type { ProgressSink } from './progress.ts';

export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high';

export interface RunSpec {
  llm: Llm;
  modelId: string;
  systemPrompt: string;
  tools: AgentTool<any>[];
  thinking?: ThinkingLevel;
  maxTurns: number;
  timeoutMs: number;
  beforeToolCall?: (c: BeforeToolCallContext) => Promise<BeforeToolCallResult | undefined>;
  sink?: ProgressSink;
  /** Previous conversation (no system message); appended after the system prompt. */
  history?: AgentMessage[];
  /** Abort from outside (e.g. client disconnected). */
  signal?: AbortSignal;
}

export interface RunStats {
  turns: number;
  toolCalls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
}

export type StopReason = 'done' | 'timeout' | 'max_turns' | 'aborted' | 'error';

export interface RunOutcome {
  agent: Agent;
  stop: StopReason;
  errorMessage?: string | undefined;
  stats: RunStats;
  /** Messages appended during this run (user prompt, assistant, tool results). */
  newMessages: AgentMessage[];
  /** Text of the final assistant message, if any. */
  finalText: string;
}

/** Turn pi `subscribe` events into typed progress events. */
export function bridge(agent: Agent, sink: ProgressSink, onTurn?: (n: number) => void): () => void {
  let turn = 0;
  return agent.subscribe((e: AgentEvent) => {
    switch (e.type) {
      case 'turn_start':
        turn++;
        onTurn?.(turn);
        sink({ type: 'turn', n: turn });
        break;
      case 'tool_execution_start':
        sink({ type: 'tool_start', tool: e.toolName, args: e.args });
        break;
      case 'tool_execution_end':
        sink({ type: 'tool_end', tool: e.toolName, ok: !e.isError, ms: Math.round(e.durationMs ?? 0) });
        break;
      default:
    }
  });
}

/** One Agent per request. Applies the turn limit and timeout, and aggregates usage. */
export async function runAgent(spec: RunSpec, prompt: string, images?: ImageContent[]): Promise<RunOutcome> {
  const model = spec.llm.getModel(spec.modelId);
  const agent = new Agent({
    initialState: { systemPrompt: spec.systemPrompt, model, tools: spec.tools, thinkingLevel: spec.thinking ?? 'low' },
    streamFn: spec.llm.streamFn,
    toolExecution: 'parallel',
    ...(spec.beforeToolCall ? { beforeToolCall: async (c) => spec.beforeToolCall!(c) } : {}),
  });
  if (spec.history?.length) agent.state.messages = [...agent.state.messages, ...spec.history];
  const baseLen = agent.state.messages.length;

  let stop: StopReason = 'done';
  let toolCalls = 0;
  let turns = 0;
  const unsub = bridge(
    agent,
    (e) => {
      if (e.type === 'tool_start') toolCalls++;
      spec.sink?.(e);
    },
    (n) => {
      turns = n;
      if (n > spec.maxTurns && stop === 'done') {
        stop = 'max_turns';
        agent.abort();
      }
    },
  );
  const timer = setTimeout(() => {
    if (stop === 'done') {
      stop = 'timeout';
      agent.abort();
    }
  }, spec.timeoutMs);
  const onExternalAbort = () => {
    if (stop === 'done') {
      stop = 'aborted';
      agent.abort();
    }
  };
  spec.signal?.addEventListener('abort', onExternalAbort, { once: true });
  if (spec.signal?.aborted) onExternalAbort();

  const t0 = performance.now();
  try {
    if (stop === 'done') await agent.prompt(prompt, images);
    await agent.waitForIdle();
  } finally {
    clearTimeout(timer);
    unsub();
    spec.signal?.removeEventListener('abort', onExternalAbort);
  }
  const latencyMs = Math.round(performance.now() - t0);

  const newMessages = agent.state.messages.slice(baseLen);
  const assistants = newMessages.filter((m): m is AssistantMessage => (m as AssistantMessage).role === 'assistant');
  const stats: RunStats = {
    turns,
    toolCalls,
    inputTokens: sum(assistants, (m) => m.usage.input + m.usage.cacheRead),
    outputTokens: sum(assistants, (m) => m.usage.output),
    totalTokens: sum(assistants, (m) => m.usage.totalTokens),
    costUsd: sum(assistants, (m) => m.usage.cost.total),
    latencyMs,
  };
  const last = assistants.at(-1);
  let errorMessage: string | undefined;
  if (stop === 'done' && last?.stopReason === 'error') {
    stop = 'error';
    errorMessage = last.errorMessage ?? agent.state.errorMessage;
  } else if (stop === 'done' && last?.stopReason === 'aborted') {
    stop = 'aborted';
  }
  const finalText = last
    ? last.content
        .filter((c): c is Extract<typeof c, { type: 'text' }> => c.type === 'text')
        .map((c) => c.text)
        .join('')
    : '';
  return { agent, stop, errorMessage, stats, newMessages, finalText };
}

function sum<T>(xs: T[], f: (x: T) => number): number {
  return xs.reduce((a, x) => a + (f(x) || 0), 0);
}
