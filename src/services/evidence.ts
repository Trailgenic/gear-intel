import { getProductVersion, saveSourceExtraction } from '../db/queries.js';
import type { z } from 'zod';
import type { SourceImportSchema } from '../domain/schemas.js';
import { getEvidenceProvider } from '../llm/index.js';
import { OPENAI_EXTRACTION_PROMPT_VERSION } from '../llm/openai.js';
import { retrieveSource } from '../retrieval/retrieve.js';
import { getRubric } from '../rubrics/index.js';
import { calibrateEvidenceExtraction } from './evidence-calibration.js';

type SourceImport = z.infer<typeof SourceImportSchema>;

const reliabilityByType: Record<SourceImport['sourceType'], number> = {
  manufacturer: 0.9,
  expert_review: 0.8,
  scientific: 0.95,
  community: 0.55,
  operator_note: 0.7
};

export async function importEvidence(input: SourceImport) {
  const product = await getProductVersion(input.productVersionId);
  if (!product) throw new Error('Product version not found');
  const source = await retrieveSource(input.url, product.manufacturerUrl);
  const provider = getEvidenceProvider();
  const extraction = await provider.extractEvidence({
    product: { displayName: product.displayName, brand: product.brand, modelVersion: product.modelVersion },
    source: {
      url: source.url,
      title: source.title,
      publisher: source.publisher,
      sourceType: input.sourceType,
      ...(input.publishedAt ? { publishedAt: input.publishedAt } : {})
    },
    content: source.text,
    rubric: getRubric(product.categoryKey)
  });
  const calibrated = calibrateEvidenceExtraction(input.sourceType, extraction.data);
  if (calibrated.productMatch === 'mismatch') throw new Error('Source does not match the requested product version');
  const saved = await saveSourceExtraction({
    productVersionId: product.productVersionId,
    url: source.url,
    publisher: source.publisher,
    sourceType: input.sourceType,
    title: source.title,
    ...(input.publishedAt ? { publishedAt: input.publishedAt } : {}),
    ...(input.evidenceCutoff ? { evidenceCutoff: input.evidenceCutoff } : {}),
    contentHash: source.contentHash,
    provider: extraction.provider,
    model: extraction.model,
    promptVersion: OPENAI_EXTRACTION_PROMPT_VERSION,
    usage: extraction.usage,
    extraction: calibrated,
    reliability: reliabilityByType[input.sourceType]
  });
  return { ...saved, productMatch: calibrated.productMatch, claimCount: calibrated.claims.length, warnings: calibrated.conflictsOrWarnings };
}
