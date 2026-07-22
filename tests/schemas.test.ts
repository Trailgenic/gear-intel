import { describe, expect, it } from 'vitest';
import { EvidenceExtractionSchema, PublishReportSchema } from '../src/domain/schemas.js';

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
});
