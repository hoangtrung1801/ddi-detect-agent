import type { IngredientPair, PairKind, PairStatus, Severity, SourceInteractionRecord } from "@/lib/report";

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
  severitySource?: "DDInter 2.0" | "model";
  sourceRecords?: SourceInteractionRecord[];
  /** Interacting ingredient pairs when a drug is a multi-ingredient product. */
  ingredientPairs?: IngredientPair[];
  /** True while the run is still going and severity/explanation are not known yet. */
  pending: boolean;
}

export interface DisplayDrug {
  label: string;
  input: string;
  resolved: boolean;
}

export type KindFilter = "all" | PairKind;
