import type { AssessmentResult, DimensionResult, RubricDefinition, ScoringEvidence } from '../domain/rubric.js';

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 100) / 100;

function signalValue(signal: ScoringEvidence['signal']): number {
  if (signal === 'positive') return 1;
  if (signal === 'negative') return -1;
  if (signal === 'conditional') return 0.25;
  return 0;
}

function scoreDimension(
  dimension: RubricDefinition['dimensions'][number],
  evidence: ScoringEvidence[]
): DimensionResult {
  const relevant = evidence.filter((item) => item.dimensionKey === dimension.key);
  const sourceCount = new Set(relevant.map((item) => item.sourceId)).size;
  if (relevant.length < dimension.minimumEvidence) {
    return { key: dimension.key, label: dimension.label, score: null, evidenceCount: relevant.length, sourceCount, confidence: 0 };
  }

  let numerator = 0;
  let denominator = 0;
  for (const item of relevant) {
    const quality = clamp(item.reliability, 0, 1) * clamp(item.applicability, 0, 1);
    const strength = clamp(item.strength, 1, 5) / 5;
    numerator += signalValue(item.signal) * strength * quality;
    denominator += quality;
  }

  const normalized = denominator === 0 ? 0 : numerator / denominator;
  const score = clamp(50 + 50 * normalized);
  const diversity = Math.min(1, sourceCount / 2);
  const volume = Math.min(1, relevant.length / Math.max(2, dimension.minimumEvidence + 1));
  const averageQuality = denominator / relevant.length;
  const confidence = clamp(averageQuality * diversity * volume, 0, 1);

  return {
    key: dimension.key,
    label: dimension.label,
    score: round(score),
    evidenceCount: relevant.length,
    sourceCount,
    confidence: round(confidence)
  };
}

export function calculateAssessment(
  rubric: RubricDefinition,
  evidence: ScoringEvidence[],
  hasConflicts = false
): AssessmentResult {
  const dimensions = rubric.dimensions.map((dimension) => scoreDimension(dimension, evidence));
  const available = dimensions.filter((dimension) => dimension.score !== null);
  const coveredWeight = rubric.dimensions
    .filter((dimension) => available.some((result) => result.key === dimension.key))
    .reduce((sum, dimension) => sum + dimension.weight, 0);
  const evidenceCoverage = round(coveredWeight);
  const sourceDiversity = new Set(evidence.map((item) => item.sourceId)).size;

  const weighted = rubric.dimensions.reduce((sum, dimension) => {
    const result = dimensions.find((candidate) => candidate.key === dimension.key);
    return result?.score === null || result?.score === undefined ? sum : sum + result.score * dimension.weight;
  }, 0);
  const fitScore = coveredWeight >= rubric.minimumCoverage ? round(weighted / coveredWeight) : null;

  const dimensionConfidence = available.length
    ? available.reduce((sum, dimension) => sum + dimension.confidence, 0) / available.length
    : 0;
  const diversityFactor = Math.min(1, sourceDiversity / rubric.minimumSourceDiversity);
  const confidence = round(clamp(dimensionConfidence * coveredWeight * diversityFactor, 0, 1));

  let evidenceState: AssessmentResult['evidenceState'];
  if (hasConflicts) evidenceState = 'conflicting';
  else if (fitScore === null || sourceDiversity < rubric.minimumSourceDiversity) evidenceState = 'insufficient';
  else if (confidence >= 0.75) evidenceState = 'verified';
  else if (confidence >= 0.5) evidenceState = 'supported';
  else evidenceState = 'preliminary';

  let fitLabel: AssessmentResult['fitLabel'];
  if (fitScore === null) fitLabel = 'insufficient';
  else if (fitScore >= 75) fitLabel = 'strong';
  else if (fitScore >= 55) fitLabel = 'conditional';
  else fitLabel = 'limited';

  return { fitScore, confidence, evidenceCoverage, evidenceState, fitLabel, dimensions };
}
