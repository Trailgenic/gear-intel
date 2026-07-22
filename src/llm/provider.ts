import type { EvidenceExtraction } from '../domain/schemas.js';
import type { RubricDefinition } from '../domain/rubric.js';

export interface ExtractionRequest {
  product: { displayName: string; brand: string; modelVersion: string };
  source: { url: string; title: string; publisher: string; sourceType: string; publishedAt?: string };
  content: string;
  rubric: RubricDefinition;
}

export interface ExtractionResponse {
  data: EvidenceExtraction;
  model: string;
  provider: string;
  usage: { inputTokens?: number; outputTokens?: number };
}

export interface EvidenceModelProvider {
  extractEvidence(request: ExtractionRequest): Promise<ExtractionResponse>;
}
