import { z } from 'zod';

const stringField = (min = 1) =>
  z.preprocess((val) => {
    if (typeof val === 'number' || typeof val === 'boolean') {
      return String(val);
    }
    if (typeof val === 'string') {
      return val;
    }
    return val ?? undefined;
  }, z.string().min(min));

const optionalStringField = () =>
  z.preprocess((val) => {
    if (val == null) return undefined;
    if (typeof val === 'number' || typeof val === 'boolean') {
      return String(val);
    }
    return val;
  }, z.string()).optional();

export const SourceSpanSchema = z.object({
  paragraphIndex: z.number().int().nonnegative(),
  sentenceIndex: z.number().int().nonnegative()
});

export const NumberQualifierEnum = z.enum([
  'AT_LEAST',
  'AT_MOST',
  'APPROX',
  'GREATER',
  'LESS',
  'EQUAL'
]);

export const ClaimNumberSchema = z.object({
  key: optionalStringField(), // e.g., fatalities/injured/budget
  value: z.preprocess((val) => {
    if (typeof val === 'string') {
      const n = Number(val.replace(/[^0-9.+-]/g, ''));
      return Number.isFinite(n) ? n : undefined;
    }
    return val;
  }, z.number()),
  qualifier: NumberQualifierEnum.optional(),
  unit: optionalStringField()
});

export const NormalizedClaimSchema = z.object({
  subject: stringField(),
  predicate: stringField(),
  object: stringField(),
  time: optionalStringField(),
  unit: optionalStringField(),
  location: optionalStringField(),
  event: optionalStringField(),
  entities: z.array(stringField()).optional(),
  numbers: z.array(ClaimNumberSchema).optional(),
  qualifiers: z.array(stringField()).optional()
});

export const ClaimSchema = z.object({
  id: stringField(),
  text: stringField(3),
  normalized: NormalizedClaimSchema,
  checkworthy: z.boolean(),
  confidence: z.number().min(0).max(1),
  source_span: SourceSpanSchema
});

export const EvidenceCandidateSchema = z.object({
  id: z.string().min(1),
  source: z.enum(['wikipedia', 'web', 'wikidata']),
  url: z.string().url(),
  title: z.string().min(1),
  quote: z.string().min(1),
  published_at: z.string().optional(),
  authority: z.number().min(0).max(1)
});

export const VerificationSchema = z.object({
  claimId: z.string().min(1),
  label: z.enum(['SUPPORTED', 'REFUTED', 'DISPUTED', 'INSUFFICIENT']),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(3),
  citations: z.array(z.string().url()).default([])
});

export const ParsedDocumentSchema = z.object({
  paragraphs: z.array(z.string()),
  sentences: z.array(z.string()),
  mapping: z.array(SourceSpanSchema)
});

export const ExtractResponseSchema = ParsedDocumentSchema;

export const ClaimsRequestSchema = z.object({
  sentences: z.array(z.string().min(1)),
  mapping: z.array(SourceSpanSchema),
  context: z.string().optional()
});

export const ClaimsResponseSchema = z.array(ClaimSchema);

export const SearchRequestSchema = z.object({
  claim: ClaimSchema,
  sources: z.array(z.enum(['wikipedia', 'web', 'wikidata'])).optional(),
  llm_expand: z.boolean().optional(),
  site_prefs: z.array(z.string()).optional(),
  freshness: z.enum(['m3', 'm6', 'y1', 'any']).optional(),
  limit: z.number().int().positive().max(20).optional(),
  context: z.string().optional()
});

export const SearchResponseSchema = z.array(EvidenceCandidateSchema);

export const VerifyRequestSchema = z.object({
  claim: ClaimSchema,
  evidences: z.array(EvidenceCandidateSchema),
  context: z.string().optional()
});

export const VerifyResponseSchema = z.array(VerificationSchema);

export const ReportRequestSchema = z.object({
  claims: z.array(ClaimSchema),
  verifications: z.array(VerificationSchema),
  generatedAt: z.string().optional()
});

export const ReportResponseSchema = z.object({
  markdown: z.string().min(10)
});

export type Claim = z.infer<typeof ClaimSchema>;
export type EvidenceCandidate = z.infer<typeof EvidenceCandidateSchema>;
export type Verification = z.infer<typeof VerificationSchema>;
export type ParsedDocument = z.infer<typeof ParsedDocumentSchema>;
