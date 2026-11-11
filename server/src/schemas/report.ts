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

/** AI-written Vietnamese pharmacology for an INTERACTION pair: why the combination is harmful. General knowledge, not source data. */
export const PairAnalysisSchema = Type.Object({
  mechanism_type: Type.Union([Type.Literal('pharmacodynamic'), Type.Literal('pharmacokinetic'), Type.Literal('mixed'), Type.Literal('unknown')], {
    description: 'pharmacodynamic = additive/opposing effects on the same target or system; pharmacokinetic = one drug changes absorption, metabolism (e.g. CYP450), transport or excretion of the other; mixed = both',
  }),
  why_harmful: Type.String({
    description:
      'Detailed Vietnamese explanation (4-7 sentences) of WHY this combination is harmful: what each drug does in the body, which pathway/enzyme/receptor/organ they share, how the effects add up or one changes the level of the other, and the resulting clinical danger. Plain language a patient can follow, with medical terms explained in parentheses.',
  }),
  chain: Type.Array(
    Type.Object({
      actor: Type.String({ description: 'Who acts in this step: a drug name from the pair, or "Khi dùng chung" for the combined result' }),
      effect: Type.String({ description: 'Short Vietnamese effect (max ~15 words), e.g. "Ức chế vitamin K → giảm các yếu tố đông máu II, VII, IX, X"' }),
    }),
    { minItems: 2, maxItems: 5, description: 'Mechanism chain: one step per drug, then the combined result last' },
  ),
  consequences: Type.Array(Type.String(), { maxItems: 6, description: 'Vietnamese clinical consequences / warning signs (short phrases)' }),
  risk_factors: Type.Array(Type.String(), { maxItems: 5, description: 'Vietnamese: who is at higher risk (elderly, kidney/liver disease, high dose, ...)' }),
  monitoring: Type.Array(Type.String(), { maxItems: 5, description: 'Vietnamese: what to monitor (lab tests such as INR, symptoms). No dose changes.' }),
  onset: Type.Optional(Type.String({ description: 'Vietnamese: when the effect usually appears, if generally known' })),
  management_vi: Type.Optional(
    Type.String({ description: 'Faithful Vietnamese translation of the DDInter "Management (source quote)" when one was provided; omit when the source has none' }),
  ),
});
export type PairAnalysis = Static<typeof PairAnalysisSchema>;

/** AI-written Vietnamese pharmacology profile of one active ingredient involved in an interaction. */
export const DrugProfileSchema = Type.Object({
  name: Type.String({ description: 'Database name of the active ingredient (as in check_interactions)' }),
  drug_class: Type.String({ description: 'Vietnamese pharmacological class, e.g. "Thuốc chống đông kháng vitamin K"' }),
  mechanism: Type.String({ description: 'Vietnamese mechanism of action, 1-3 sentences' }),
  indications: Type.Array(Type.String(), { maxItems: 4, description: 'Vietnamese main uses' }),
  pharmacokinetics: Type.String({ description: 'Vietnamese key pharmacokinetics: absorption, metabolism (CYP enzymes), half-life, elimination; 1-3 sentences' }),
  adverse_effects: Type.Array(Type.String(), { maxItems: 5, description: 'Vietnamese notable adverse effects' }),
  interaction_role: Type.String({ description: 'Vietnamese: the property of this drug that drives the interaction(s) in this report, 1 sentence' }),
});
export type DrugProfile = Static<typeof DrugProfileSchema>;

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
  /** INTERACTION pairs only: AI pharmacology analysis (labelled as AI interpretation in the UI). */
  analysis: Type.Optional(PairAnalysisSchema),
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
  /** Pharmacology profiles of the active ingredients involved in INTERACTION pairs, keyed by database name. AI interpretation. */
  drug_profiles: Type.Optional(Type.Record(Type.String(), DrugProfileSchema)),
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
      explanation: Type.String({ description: 'Vietnamese plain-language summary for this pair (1-2 sentences: what happens and how serious)' }),
      analysis: Type.Optional(PairAnalysisSchema),
    }),
  ),
  drug_profiles: Type.Optional(
    Type.Array(DrugProfileSchema, {
      maxItems: 12,
      description: 'One profile per active ingredient that takes part in an INTERACTION pair (not for drugs that only have NO_RECORD/UNRESOLVED pairs)',
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
