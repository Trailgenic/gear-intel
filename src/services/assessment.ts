import { createAssessment, getEvidenceContext, getProductVersion, getVerifiedEvidence } from '../db/queries.js';
import { draftAssessmentNarrative } from '../llm/narrative.js';
import { getRubric } from '../rubrics/index.js';
import { calculateAssessment } from '../scoring/score.js';

export async function assessProduct(input: {
  productVersionId: string;
  evidenceCutoff: string;
  quarter?: string;
  runType: 'manual' | 'weekly_refresh' | 'quarterly' | 'reassessment';
}) {
  const { productVersionId, evidenceCutoff } = input;
  const product = await getProductVersion(productVersionId);
  if (!product) throw new Error('Product version not found');
  const evidence = await getVerifiedEvidence(productVersionId, evidenceCutoff);
  const context = await getEvidenceContext(productVersionId, evidenceCutoff);
  const rubric = getRubric(product.categoryKey);
  const result = calculateAssessment(rubric, evidence, context.hasConflicts);
  const { narrative, model: narrativeModel } = await draftAssessmentNarrative({
    productName: product.displayName,
    rubric,
    result,
    evidence: context.narrative
  });
  const assessmentId = await createAssessment({
    productVersionId,
    rubric,
    result,
    evidence,
    summary: narrative.summary,
    limitations: [narrative.limitations, ...narrative.conditions].filter(Boolean).join(' '),
    evidenceCutoff,
    ...(input.quarter ? { quarter: input.quarter } : {}),
    runType: input.runType
  });
  return { assessmentId, product, rubricVersion: rubric.version, narrativeModel, narrative, ...result };
}
