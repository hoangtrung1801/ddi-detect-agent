// Response shapes of the legacy Python API (app/models/responses.py, app/agents/models.py).
// They stand in for recorded Python outputs, which need the paid LLM stack to be running (see plan log, M0).
import { Type } from 'typebox';

const Ref = Type.Union([Type.Object({ name: Type.String(), link: Type.Union([Type.String(), Type.Null()]) }), Type.Null()]);

export const QueryResponseShape = Type.Object({
  answer: Type.String(),
  drug_links: Type.Record(Type.String(), Type.String()),
  parsed_result: Type.Object({
    step: Type.Number(),
    title: Type.String(),
    drug_conversion: Type.Array(Type.Object({ original: Type.String(), converted: Type.String(), reference: Ref })),
    interactions: Type.Array(
      Type.Object({ drug1: Type.String(), drug2: Type.String(), status: Type.String(), details: Type.String(), reference1: Ref, reference2: Ref }),
    ),
    summary: Type.Object({
      overall_risk: Type.String(),
      major_interactions: Type.Array(Type.String()),
      recommendations: Type.Array(Type.String()),
    }),
  }),
});
export const ChatResponseShape = Type.Object({ answer: Type.String(), session_id: Type.String(), timestamp: Type.String() });
export const StatsShape = Type.Object({ total_drugs: Type.Integer(), total_interactions: Type.Integer(), active_sessions: Type.Integer() });
export const HealthShape = Type.Object({ status: Type.String(), agent_loaded: Type.Boolean(), timestamp: Type.String() });
export const ExtractShape = Type.Object({ result: Type.Array(Type.String()), timestamp: Type.String() });
export const AddDrugShape = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
  drug_name: Type.String(),
  user_id: Type.String(),
  checking_interactions: Type.Boolean(),
  timestamp: Type.String(),
});
export const CabinetListShape = Type.Object({
  user_id: Type.String(),
  drugs: Type.Array(Type.Object({ drug_name: Type.String(), interactions: Type.Union([Type.String(), Type.Null()]) })),
  count: Type.Integer(),
  timestamp: Type.String(),
});
export const DrugInteractionsShape = Type.Object({
  drug_name: Type.String(),
  user_id: Type.String(),
  interactions: Type.Array(
    Type.Object({
      drug1: Type.String(),
      drug2: Type.String(),
      interaction: Type.Union([Type.String(), Type.Null()]),
      has_interaction: Type.Boolean(),
      severity: Type.Union([Type.String(), Type.Null()]),
      checked_at: Type.String(),
    }),
  ),
  total_interactions: Type.Integer(),
  timestamp: Type.String(),
});
export const RemoveShape = Type.Object({ success: Type.Boolean(), message: Type.String(), drug_name: Type.String(), user_id: Type.String(), timestamp: Type.String() });
export const ClearShape = Type.Object({ success: Type.Boolean(), message: Type.String(), user_id: Type.String(), timestamp: Type.String() });
