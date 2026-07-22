import { describe, expect, it } from 'vitest';
import { CandidateReviewBatchSchema, EvidenceExtractionSchema, PublishReportSchema } from '../src/domain/schemas.js';

describe('boundary schemas', () => {
  it('rejects an out-of-range evidence strength', () => {
    expect(() => EvidenceExtractionSchema.parse({
      productMatch: 'exact', sourceSummary: 'summary', conflictsOrWarnings: [],
      claims: [{ dimensionKey: 'traction', claim: 'claim', excerpt: 'excerpt', signal: 'positive', strength: 9, applicability: 1, limitations: '' }]
    })).toThrow();
  });

  it('requires a quarter-shaped report identifier and approved assessments', () => {
    expect(() => PublishReportSchema.parse({
      title: 'Report', quarter: 'Q2', evidenceCutoff: '2026-06-30', rubricVersion: '2.0.0', assessmentIds: [], approvedBy: 'Reviewer'
    })).toThrow();
  });

  it('validates candidate review decisions and correction overlays', () => {
    expect(CandidateReviewBatchSchema.parse({
      reviews: [{
        candidateId: '15fe4342-6053-4171-a4b1-6317870aa977',
        decision: 'accepted',
        reviewer: 'Mike Ye',
        corrections: {
          modelVersion: '2026 / AL0A85WT',
          evidenceUrls: ['https://brand.example/product', 'https://review.example/product']
        }
      }]
    }).reviews[0]?.decision).toBe('accepted');
    expect(() => CandidateReviewBatchSchema.parse({ reviews: [{ candidateId: 'not-a-uuid', decision: 'publish', reviewer: '' }] })).toThrow();
  });
});
