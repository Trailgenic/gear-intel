import { z } from 'zod';

export const categoryKeys = [
  'backpacks', 'trail-shoes', 'insulation', 'trekking-poles',
  'electrolytes', 'hydration', 'shell-rain', 'headlamps'
] as const;

export const CategoryKeySchema = z.enum(categoryKeys);
export type CategoryKey = z.infer<typeof CategoryKeySchema>;

export const ProductStatusSchema = z.enum(['candidate', 'active', 'stale', 'discontinued', 'rejected']);
export const EvidenceStateSchema = z.enum(['unverified', 'verified', 'conflicting', 'rejected']);
export const SourceTypeSchema = z.enum(['manufacturer', 'expert_review', 'community', 'scientific', 'operator_note']);
export type SourceType = z.infer<typeof SourceTypeSchema>;
export const EvidenceSignalSchema = z.enum(['positive', 'negative', 'neutral', 'conditional']);
export const ClaimBasisSchema = z.enum([
  'specification', 'manufacturer_claim', 'independent_observation',
  'controlled_test', 'community_report', 'operator_observation'
]);
export type ClaimBasis = z.infer<typeof ClaimBasisSchema>;

export const ProductInputSchema = z.object({
  brand: z.string().trim().min(1).max(120),
  productFamily: z.string().trim().min(1).max(180),
  modelVersion: z.string().trim().max(120).default('current'),
  displayName: z.string().trim().min(1).max(240),
  categoryKey: CategoryKeySchema,
  manufacturerUrl: z.string().url().optional(),
  specifications: z.record(z.string(), z.unknown()).default({})
});

export const SourceImportSchema = z.object({
  productVersionId: z.string().uuid(),
  url: z.string().url(),
  sourceType: SourceTypeSchema,
  publishedAt: z.string().date().optional(),
  evidenceCutoff: z.string().date().optional()
});

export const EvidenceClaimSchema = z.object({
  dimensionKey: z.string().min(1).max(80),
  claim: z.string().min(1).max(1000),
  excerpt: z.string().min(1).max(500),
  claimBasis: ClaimBasisSchema,
  signal: EvidenceSignalSchema,
  strength: z.number().int().min(1).max(5),
  applicability: z.number().min(0).max(1),
  limitations: z.string().max(500).default('')
});

export const EvidenceExtractionSchema = z.object({
  productMatch: z.enum(['exact', 'family', 'uncertain', 'mismatch']),
  sourceSummary: z.string().min(1).max(1200),
  claims: z.array(EvidenceClaimSchema).max(30),
  conflictsOrWarnings: z.array(z.string().max(500)).max(20).default([])
});

export type EvidenceExtraction = z.infer<typeof EvidenceExtractionSchema>;

export const AssessmentNarrativeSchema = z.object({
  summary: z.string().trim().min(1).max(1200),
  limitations: z.string().trim().max(1000),
  conditions: z.array(z.string().trim().min(1).max(300)).max(8)
});

export type AssessmentNarrative = z.infer<typeof AssessmentNarrativeSchema>;

export const ReviewDecisionSchema = z.object({
  assessmentId: z.string().uuid(),
  decision: z.enum(['approved', 'changes_requested', 'rejected']),
  reviewer: z.string().trim().min(1).max(160),
  note: z.string().trim().max(3000).default('')
});

export const PublishReportSchema = z.object({
  title: z.string().trim().min(1).max(240),
  quarter: z.string().regex(/^\d{4}-Q[1-4]$/),
  evidenceCutoff: z.string().date(),
  rubricVersion: z.string().trim().min(1).max(40),
  assessmentIds: z.array(z.string().uuid()).min(1).max(500),
  approvedBy: z.string().trim().min(1).max(160)
});

export const DiscoveryCandidateSchema = z.object({
  categoryKey: CategoryKeySchema,
  brand: z.string().trim().min(1).max(120),
  productName: z.string().trim().min(1).max(240),
  modelVersion: z.string().trim().min(1).max(120),
  officialUrl: z.string().url().nullable(),
  rationale: z.string().trim().min(1).max(1200),
  trendSignals: z.array(z.string().trim().min(1).max(300)).min(1).max(8),
  evidenceUrls: z.array(z.string().url()).min(1).max(8),
  trendScore: z.number().min(0).max(100)
});

export const DiscoveryOutputSchema = z.object({
  candidates: z.array(DiscoveryCandidateSchema).max(40)
});

export type DiscoveryCandidate = z.infer<typeof DiscoveryCandidateSchema>;

export const CandidateCorrectionsSchema = z.object({
  categoryKey: CategoryKeySchema.optional(),
  brand: z.string().trim().min(1).max(120).optional(),
  productName: z.string().trim().min(1).max(240).optional(),
  modelVersion: z.string().trim().min(1).max(120).optional(),
  officialUrl: z.string().url().nullable().optional(),
  rationale: z.string().trim().min(1).max(1200).optional(),
  evidenceUrls: z.array(z.string().url()).min(2).max(8).optional(),
  trendSignals: z.array(z.string().trim().min(1).max(300)).min(1).max(8).optional()
}).strict();

export const CandidateReviewSchema = z.object({
  candidateId: z.string().uuid(),
  decision: z.enum(['accepted', 'held', 'rejected', 'duplicate']),
  reviewer: z.string().trim().min(1).max(160),
  note: z.string().trim().max(3000).default(''),
  corrections: CandidateCorrectionsSchema.default({})
});

export const CandidateReviewBatchSchema = z.object({
  reviews: z.array(CandidateReviewSchema).min(1).max(40)
});

export type CandidateReview = z.infer<typeof CandidateReviewSchema>;

export const PromoteCandidateSchema = z.object({
  candidateId: z.string().uuid(),
  reviewer: z.string().trim().min(1).max(160)
});
