import { describe, expect, it } from 'vitest';
import type { ScoringEvidence } from '../src/domain/rubric.js';
import { getRubric } from '../src/rubrics/index.js';
import { calculateAssessment } from '../src/scoring/score.js';

function evidenceForEveryDimension(signal: ScoringEvidence['signal']): ScoringEvidence[] {
  return getRubric('backpacks').dimensions.flatMap((dimension, index) => [
    { id: `${index}-a`, dimensionKey: dimension.key, signal, strength: 5, reliability: 0.9, applicability: 1, sourceId: 'source-a' },
    { id: `${index}-b`, dimensionKey: dimension.key, signal, strength: 4, reliability: 0.8, applicability: 0.9, sourceId: 'source-b' }
  ]);
}

describe('deterministic assessment scoring', () => {
  it('scores strong, diverse positive evidence without conflating confidence', () => {
    const result = calculateAssessment(getRubric('backpacks'), evidenceForEveryDimension('positive'));
    expect(result.fitScore).toBeGreaterThan(90);
    expect(result.fitLabel).toBe('strong');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.evidenceCoverage).toBe(1);
  });

  it('returns insufficient instead of inventing scores when coverage is missing', () => {
    const result = calculateAssessment(getRubric('backpacks'), []);
    expect(result.fitScore).toBeNull();
    expect(result.fitLabel).toBe('insufficient');
    expect(result.evidenceState).toBe('insufficient');
    expect(result.confidence).toBe(0);
  });

  it('surfaces conflicts separately from fit', () => {
    const result = calculateAssessment(getRubric('backpacks'), evidenceForEveryDimension('positive'), true);
    expect(result.fitScore).not.toBeNull();
    expect(result.evidenceState).toBe('conflicting');
  });
});
