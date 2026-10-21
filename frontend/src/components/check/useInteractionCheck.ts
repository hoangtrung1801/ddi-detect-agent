import { useCallback, useMemo, useRef, useState } from "react";
import { v2API } from "@/lib/api";
import {
  drugLabel,
  pairId,
  pairKind,
  sortPairs,
  type InteractionReport,
  type PairResult,
  type ProgressEvent,
  type ResolvedDrug,
} from "@/lib/report";
import type { DisplayDrug, DisplayPair } from "./types";

export type StepId = "resolve" | "pairs" | "links" | "report";
export type StepState = "pending" | "active" | "done";

const TOOL_STEP: Record<string, StepId> = {
  resolve_drugs: "resolve",
  check_interactions: "pairs",
  drug_links: "links",
  submit_report: "report",
};

interface RunState {
  running: boolean;
  steps: Record<StepId, StepState>;
  resolved: ResolvedDrug[];
  livePairs: PairResult[];
  report: InteractionReport | null;
  error: string | null;
}

const IDLE: RunState = {
  running: false,
  steps: { resolve: "pending", pairs: "pending", links: "pending", report: "pending" },
  resolved: [],
  livePairs: [],
  report: null,
  error: null,
};

function applyEvent(s: RunState, e: ProgressEvent): RunState {
  switch (e.type) {
    case "tool_start": {
      const step = TOOL_STEP[e.tool];
      return step && s.steps[step] !== "done" ? { ...s, steps: { ...s.steps, [step]: "active" } } : s;
    }
    case "tool_end": {
      const step = TOOL_STEP[e.tool];
      return step && e.ok ? { ...s, steps: { ...s.steps, [step]: "done" } } : s;
    }
    case "resolved":
      return { ...s, resolved: e.drugs };
    case "pairs":
      return { ...s, livePairs: e.pairs };
    default:
      return s;
  }
}

/** Runs a streamed v2 interaction check and exposes live and final results in display form. */
export function useInteractionCheck() {
  const [state, setState] = useState<RunState>(IDLE);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (drugs: string[]): Promise<InteractionReport | null> => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setState({ ...IDLE, running: true, steps: { ...IDLE.steps, resolve: "active" } });
    try {
      const report = await v2API.checkInteractions(drugs, (e) => setState((s) => applyEvent(s, e)), ac.signal);
      setState((s) => ({
        ...s,
        running: false,
        report,
        resolved: report.drugs,
        steps: { resolve: "done", pairs: "done", links: "done", report: "done" },
      }));
      return report;
    } catch (err) {
      if (ac.signal.aborted) return null;
      setState((s) => ({ ...s, running: false, error: err instanceof Error ? err.message : "Không thể kiểm tra tương tác" }));
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(IDLE);
  }, []);

  const drugs: DisplayDrug[] = useMemo(() => {
    // Resolved drugs first, unidentified ones last so their dashed lines sit at the edge of the map.
    const list = state.resolved.map((d) => ({ label: drugLabel(d), input: d.input, resolved: d.dbName !== null }));
    return [...list.filter((d) => d.resolved), ...list.filter((d) => !d.resolved)];
  }, [state.resolved]);

  const pairs: DisplayPair[] = useMemo(() => {
    if (state.report) {
      return sortPairs(state.report.pairs).map((p) => ({
        id: pairId(p),
        a: p.a,
        b: p.b,
        status: p.status,
        severity: p.severity,
        kind: pairKind(p),
        explanation: p.explanation,
        dbCondition: p.db_condition,
        pending: false,
      }));
    }
    return sortPairs(state.livePairs).map((p) => ({
      id: pairId(p),
      a: p.a,
      b: p.b,
      status: p.status,
      kind: pairKind(p),
      dbCondition: p.condition,
      pending: true,
    }));
  }, [state.report, state.livePairs]);

  return { ...state, drugs, pairs, run, reset };
}
