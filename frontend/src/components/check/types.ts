import type { PairKind, PairStatus, Severity } from "@/lib/report";

/** A pair as the results UI shows it: a finished report pair, or a live one still waiting for the report. */
export interface DisplayPair {
  id: string;
  a: string;
  b: string;
  status: PairStatus;
  severity?: Severity;
  kind: PairKind;
  explanation?: string;
  dbCondition?: string;
  /** True while the run is still going and severity/explanation are not known yet. */
  pending: boolean;
}

export interface DisplayDrug {
  label: string;
  input: string;
  resolved: boolean;
}

export type KindFilter = "all" | PairKind;
