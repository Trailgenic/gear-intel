import type { EvidenceModelProvider } from './provider.js';
import { OpenAIEvidenceProvider } from './openai.js';

export function getEvidenceProvider(): EvidenceModelProvider {
  const provider = process.env.EVIDENCE_MODEL_PROVIDER ?? 'openai';
  if (provider === 'openai') return new OpenAIEvidenceProvider();
  throw new Error(`Unsupported EVIDENCE_MODEL_PROVIDER: ${provider}`);
}
