import type { CategoryKey } from './schemas.js';

export interface RubricDimension {
  key: string;
  label: string;
  weight: number;
  description: string;
  minimumEvidence: number;
}

export interface RubricDefinition {
  categoryKey: CategoryKey;
  version: string;
  label: string;
  useCase: string;
  dimensions: RubricDimension[];
  minimumCoverage: number;
  minimumSourceDiversity: number;
}

export interface ScoringEvidence {
  id: string;
  dimensionKey: string;
  signal: 'positive' | 'negative' | 'neutral' | 'conditional';
  strength: number;
  reliability: number;
  applicability: number;
  sourceId: string;
}

export interface DimensionResult {
  key: string;
  label: string;
  score: number | null;
  evidenceCount: number;
  sourceCount: number;
  confidence: number;
}

export interface AssessmentResult {
  fitScore: number | null;
  confidence: number;
  evidenceCoverage: number;
  evidenceState: 'verified' | 'supported' | 'preliminary' | 'conflicting' | 'insufficient';
  fitLabel: 'strong' | 'conditional' | 'limited' | 'insufficient';
  dimensions: DimensionResult[];
}
