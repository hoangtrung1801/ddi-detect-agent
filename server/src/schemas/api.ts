import { Type, type Static } from 'typebox';
import { InteractionReportSchema } from './report.ts';

// ---- v1 (legacy shapes, kept byte-compatible with the Python API) ----
export const QueryRequestSchema = Type.Object({
  question: Type.String({ minLength: 1 }),
  /** Optional (v1 superset): also store the report under this chat session. */
  session_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});
export const ChatRequestSchema = Type.Object({
  question: Type.String({ minLength: 1 }),
  session_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});
export const DrugNamesFromImageRequestSchema = Type.Object({ image_url: Type.String({ minLength: 1 }) });
export const AddDrugRequestSchema = Type.Object({
  drug_name: Type.String({ minLength: 1 }),
  user_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

export const ParsedResultSchema = Type.Object({
  step: Type.Number(),
  title: Type.String(),
  drug_conversion: Type.Array(
    Type.Object({
      original: Type.String(),
      converted: Type.String(),
      reference: Type.Union([Type.Object({ name: Type.String(), link: Type.Union([Type.String(), Type.Null()]) }), Type.Null()]),
    }),
  ),
  interactions: Type.Array(
    Type.Object({
      drug1: Type.String(),
      drug2: Type.String(),
      status: Type.String(),
      details: Type.String(),
      reference1: Type.Union([Type.Object({ name: Type.String(), link: Type.Union([Type.String(), Type.Null()]) }), Type.Null()]),
      reference2: Type.Union([Type.Object({ name: Type.String(), link: Type.Union([Type.String(), Type.Null()]) }), Type.Null()]),
    }),
  ),
  summary: Type.Object({
    overall_risk: Type.String(),
    major_interactions: Type.Array(Type.String()),
    recommendations: Type.Array(Type.String()),
  }),
});
export type ParsedResult = Static<typeof ParsedResultSchema>;

export const QueryResponseSchema = Type.Object({
  answer: Type.String(),
  drug_links: Type.Record(Type.String(), Type.String()),
  parsed_result: ParsedResultSchema,
});
export type QueryResponse = Static<typeof QueryResponseSchema>;

// ---- v2 ----
/** A drug name, or a product (e.g. a supplement read from a photo) whose ingredients are checked as one drug. */
const V2DrugSchema = Type.Union([
  Type.String({ minLength: 1 }),
  Type.Object({
    name: Type.String({ minLength: 1 }),
    ingredients: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { maxItems: 60 })),
  }),
]);
export const V2InteractionsRequestSchema = Type.Union([
  Type.Object({ drugs: Type.Array(V2DrugSchema, { minItems: 2, maxItems: 10 }) }),
  Type.Object({ text: Type.String({ minLength: 1 }) }),
]);
export const V2ChatRequestSchema = Type.Object({
  question: Type.String({ minLength: 1 }),
  session_id: Type.Optional(Type.String()),
});
export const ErrorCodeSchema = Type.Union([
  Type.Literal('VALIDATION'),
  Type.Literal('AGENT_TIMEOUT'),
  Type.Literal('AGENT_NO_REPORT'),
  Type.Literal('UPSTREAM_LLM'),
  Type.Literal('NOT_FOUND'),
]);
export type ErrorCode = Static<typeof ErrorCodeSchema>;
export const V2ErrorSchema = Type.Object({ error: Type.Object({ code: ErrorCodeSchema, message: Type.String() }) });
export const V2ReportResponseSchema = InteractionReportSchema;
