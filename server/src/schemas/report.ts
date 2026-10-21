import { Type, type Static } from 'typebox';

export const SeveritySchema = Type.Union([Type.Literal('major'), Type.Literal('moderate'), Type.Literal('minor')]);
export const PairStatusSchema = Type.Union([Type.Literal('interaction'), Type.Literal('no_record'), Type.Literal('unresolved')]);
export const OverallRiskSchema = Type.Union([
  Type.Literal('high'),
  Type.Literal('medium'),
  Type.Literal('low'),
  Type.Literal('none'),
  Type.Literal('unknown'),
]);

export const ResolvedDrugSchema = Type.Object({
  input: Type.String(),
  generic: Type.String(),
  dbName: Type.Union([Type.String(), Type.Null()]),
  confidence: Type.Number(),
  method: Type.Union([Type.Literal('exact'), Type.Literal('alias'), Type.Literal('vector'), Type.Literal('none')]),
  alternatives: Type.Array(Type.Object({ name: Type.String(), score: Type.Number() })),
});
export type ResolvedDrugT = Static<typeof ResolvedDrugSchema>;

export const ReportPairSchema = Type.Object({
  a: Type.String(),
  b: Type.String(),
  status: PairStatusSchema,
  severity: Type.Optional(SeveritySchema),
  db_condition: Type.Optional(Type.String()),
  explanation: Type.String(),
});
export type ReportPair = Static<typeof ReportPairSchema>;

export const LinkSchema = Type.Object({ url: Type.String(), verified: Type.Boolean() });

export const InteractionReportSchema = Type.Object({
  title: Type.String(),
  drugs: Type.Array(ResolvedDrugSchema),
  pairs: Type.Array(ReportPairSchema),
  overall_risk: OverallRiskSchema,
  recommendations: Type.Array(Type.String()),
  links: Type.Record(Type.String(), LinkSchema),
  disclaimer: Type.String(),
});
export type InteractionReport = Static<typeof InteractionReportSchema>;

/** What the model writes in `submit_report`: only text and severity. Statuses, drugs, risk and links come from code. */
export const ReportDraftSchema = Type.Object({
  title: Type.String({ description: 'Short Vietnamese title of the analysis' }),
  pairs: Type.Array(
    Type.Object({
      a: Type.String({ description: 'First drug (database name from check_interactions)' }),
      b: Type.String({ description: 'Second drug (database name from check_interactions)' }),
      severity: Type.Optional(SeveritySchema),
      explanation: Type.String({ description: 'Vietnamese explanation for this pair' }),
    }),
  ),
  recommendations: Type.Array(Type.String({ description: 'Vietnamese practical recommendations' })),
});
export type ReportDraft = Static<typeof ReportDraftSchema>;

export const DISCLAIMER_VI =
  'Thông tin chỉ mang tính tham khảo, được tổng hợp từ cơ sở dữ liệu tương tác thuốc và không thay thế tư vấn của bác sĩ hoặc dược sĩ. ' +
  '"Không có dữ liệu" nghĩa là cặp thuốc không có trong cơ sở dữ liệu, không có nghĩa là an toàn. Mức độ nghiêm trọng do mô hình AI ước lượng.';
