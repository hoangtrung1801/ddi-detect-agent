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

const resolvedFields = {
  input: Type.String(),
  generic: Type.String(),
  dbName: Type.Union([Type.String(), Type.Null()]),
  confidence: Type.Number(),
  method: Type.Union([Type.Literal('exact'), Type.Literal('alias'), Type.Literal('vector'), Type.Literal('none')]),
  alternatives: Type.Array(Type.Object({ name: Type.String(), score: Type.Number() })),
};
export const ResolvedIngredientSchema = Type.Object(resolvedFields);

/** A drug. For a multi-ingredient product (e.g. a supplement) `input` is the product name, `dbName` is set when at least one ingredient matched, and `ingredients` holds each ingredient's resolution. */
export const ResolvedDrugSchema = Type.Object({
  ...resolvedFields,
  ingredients: Type.Optional(Type.Array(ResolvedIngredientSchema)),
});
export type ResolvedDrugT = Static<typeof ResolvedDrugSchema>;

export const InteractionDetailSchema = Type.Object({
  pageId: Type.Integer(),
  drugAId: Type.String(),
  drugBId: Type.String(),
  drugAName: Type.String(),
  drugBName: Type.String(),
  level: Type.Union([Type.Literal('Major'), Type.Literal('Moderate'), Type.Literal('Minor'), Type.Literal('Unknown')]),
  mechanisms: Type.Array(Type.String()),
  description: Type.Union([Type.String(), Type.Null()]),
  management: Type.Union([Type.String(), Type.Null()]),
  references: Type.Array(Type.String()),
  url: Type.String(),
  retrievedAt: Type.String(),
  sha256: Type.String(),
});

export const SourceInteractionSchema = Type.Object({
  source: Type.Literal('DDInter 2.0'),
  drugAId: Type.String(),
  drugBId: Type.String(),
  level: Type.String(),
  url: Type.String(),
  details: Type.Optional(Type.Array(InteractionDetailSchema)),
});

export const ReportPairSchema = Type.Object({
  a: Type.String(),
  b: Type.String(),
  status: PairStatusSchema,
  severity: Type.Optional(SeveritySchema),
  db_condition: Type.Optional(Type.String()),
  severity_source: Type.Optional(Type.Union([Type.Literal('DDInter 2.0'), Type.Literal('model')])),
  source_records: Type.Optional(Type.Array(SourceInteractionSchema)),
  /** For pairs involving a multi-ingredient product: the ingredient pairs the database records. */
  ingredient_pairs: Type.Optional(Type.Array(Type.Object({ a: Type.String(), b: Type.String(), condition: Type.String() }))),
  explanation: Type.String(),
});
export type ReportPair = Static<typeof ReportPairSchema>;

export const LinkSchema = Type.Object({
  url: Type.String(),
  verified: Type.Boolean(),
  /** Where the page is: nhathuoclongchau.com.vn is preferred, then drugs.com, then a drugs.com search URL. */
  source: Type.Optional(Type.Union([Type.Literal('longchau'), Type.Literal('drugs.com'), Type.Literal('drugs.com-search')])),
  title: Type.Optional(Type.String()),
});

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

/** Model text is interpretation; code preserves source risk levels when available. */
export const ReportDraftSchema = Type.Object({
  title: Type.String({ description: 'Short Vietnamese title of the analysis' }),
  pairs: Type.Array(
    Type.Object({
      a: Type.String({ description: 'First drug (database name from check_interactions; for a multi-ingredient product, the product name as given)' }),
      b: Type.String({ description: 'Second drug (database name from check_interactions; for a multi-ingredient product, the product name as given)' }),
      severity: Type.Optional(SeveritySchema),
      explanation: Type.String({ description: 'Vietnamese explanation for this pair' }),
    }),
  ),
  recommendations: Type.Array(Type.String({ description: 'Vietnamese practical recommendations' })),
});
export type ReportDraft = Static<typeof ReportDraftSchema>;

export const DISCLAIMER_VI =
  'Thông tin chỉ mang tính tham khảo, được tổng hợp từ cơ sở dữ liệu tương tác thuốc và không thay thế tư vấn của bác sĩ hoặc dược sĩ. ' +
  '"Không có dữ liệu" nghĩa là cặp thuốc không có trong cơ sở dữ liệu, không có nghĩa là an toàn. ' +
  'Nguồn DDInter 2.0 (https://ddinter2.scbdd.com/), giấy phép CC BY-NC-SA 4.0. Mức độ DDInter được giữ nguyên khi có; Unknown nghĩa là chưa xác định, không phải nhẹ. ' +
  'Một số cặp có mô tả, hướng dẫn xử trí và tài liệu tham khảo trích từ trang DDInter, kèm liên kết và thời điểm thu thập. ' +
  'Dữ liệu chưa thu thập hoặc nguồn để trống vẫn chưa xác định. Diễn giải và khuyến nghị của AI không phải dữ liệu nguồn.';
