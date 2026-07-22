import { z } from 'zod';
import { getPool, withTransaction } from '../db/client.js';
import { fitLabelForScore } from '../publishing/report.js';
import { getRubric } from '../rubrics/index.js';

const promptVersion = 'trailgenic-editorial-score-v2-original-report-contract';

interface EvidenceClaimRow {
  sourceId: string;
  sourceType: string;
  url: string;
  title: string | null;
  dimensionKey: string;
  claim: string;
  claimBasis: string;
  signal: string;
  strength: number;
  applicability: number;
  limitations: string;
}

interface EditorialInput {
  productVersionId: string;
  name: string;
  brand: string;
  modelVersion: string;
  categoryKey: string;
  sourceCount: number;
  independentSourceCount: number;
  evidenceCount: number;
  evidenceCoverage: number;
  evidenceConfidence: number;
  evidence: EvidenceClaimRow[];
}

const EditorialOutputSchema = z.object({
  products: z.array(z.object({
    productVersionId: z.string().uuid(),
    tgScore: z.number().int().min(0).max(100),
    scores: z.array(z.object({
      label: z.enum([
        'Metabolic Load','Recovery Impact','Altitude Readiness','Longevity Protocol Fit',
        'Field Durability','Pack Weight Economics','Electrolyte/Nutrition Score'
      ]),
      value: z.number().int().min(0).max(100),
      note: z.string().trim().min(1).max(700)
    })).min(4).max(5),
    verdict: z.string().trim().min(1).max(1800),
    protocolNote: z.string().trim().min(1).max(700)
  })).max(80)
});

const editorialJsonSchema = {
  type: 'object', additionalProperties: false, required: ['products'],
  properties: {
    products: {
      type: 'array', maxItems: 8,
      items: {
        type: 'object', additionalProperties: false,
        required: ['productVersionId','tgScore','scores','verdict','protocolNote'],
        properties: {
          productVersionId: { type: 'string' },
          tgScore: { type: 'integer', minimum: 0, maximum: 100 },
          scores: {
            type: 'array', minItems: 4, maxItems: 5,
            items: {
              type: 'object', additionalProperties: false,
              required: ['label','value','note'],
              properties: {
                label: { type: 'string', enum: [
                  'Metabolic Load','Recovery Impact','Altitude Readiness','Longevity Protocol Fit',
                  'Field Durability','Pack Weight Economics','Electrolyte/Nutrition Score'
                ] },
                value: { type: 'integer', minimum: 0, maximum: 100 },
                note: { type: 'string' }
              }
            }
          },
          verdict: { type: 'string' },
          protocolNote: { type: 'string' }
        }
      }
    }
  }
} as const;

const round = (value: number) => Math.round(value * 100) / 100;

export function quarterForDate(date: Date): string {
  return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

async function loadEditorialInputs(limit = 80): Promise<{ products: EditorialInput[]; exclusions: unknown[] }> {
  const result = await getPool().query({
    text: `SELECT version.id AS product_version_id,version.display_name,version.model_version,
                  product.brand,category.key AS category_key,
                  count(DISTINCT source.id)::integer AS source_count,
                  count(DISTINCT source.id) FILTER (WHERE source.source_type<>'manufacturer')::integer AS independent_source_count,
                  count(evidence.id)::integer AS evidence_count,
                  jsonb_agg(jsonb_build_object(
                    'sourceId',source.id,'sourceType',source.source_type,'url',source.url,'title',source.title,
                    'dimensionKey',evidence.dimension_key,'claim',evidence.claim,'claimBasis',evidence.claim_basis,
                    'signal',evidence.signal,'strength',evidence.strength,'applicability',evidence.applicability,
                    'limitations',evidence.limitations
                  ) ORDER BY source.publisher,evidence.dimension_key,evidence.created_at) AS evidence
           FROM product_versions AS version
           JOIN products AS product ON product.id=version.product_id
           JOIN categories AS category ON category.id=product.category_id
           JOIN evidence_items AS evidence ON evidence.product_version_id=version.id
           JOIN evidence_extractions AS extraction ON extraction.id=evidence.extraction_id
           JOIN source_snapshots AS snapshot ON snapshot.id=evidence.source_snapshot_id
           JOIN sources AS source ON source.id=snapshot.source_id
           WHERE evidence.verification_state='verified'
             AND extraction.product_match='exact'
             AND evidence.claim_basis<>'legacy_unclassified'
           GROUP BY version.id,product.id,category.id
           ORDER BY count(DISTINCT source.id) DESC,version.display_name
           LIMIT $1`,
    values: [limit]
  });
  const products: EditorialInput[] = [];
  const exclusions: unknown[] = [];
  for (const row of result.rows) {
    const rubric = getRubric(row.category_key);
    const evidence = row.evidence as EvidenceClaimRow[];
    const covered = new Set(evidence.map((claim) => claim.dimensionKey));
    const evidenceCoverage = round(covered.size / rubric.dimensions.length);
    const sourceCount = Number(row.source_count);
    const independentSourceCount = Number(row.independent_source_count);
    const evidenceConfidence = round(Math.min(1,
      0.45 * Math.min(1, sourceCount / 3) +
      0.35 * Math.min(1, independentSourceCount / 2) +
      0.20 * evidenceCoverage
    ));
    const base = {
      productVersionId: row.product_version_id as string,
      name: row.display_name as string,
      brand: row.brand as string,
      modelVersion: row.model_version as string,
      categoryKey: row.category_key as string,
      sourceCount,
      independentSourceCount,
      evidenceCount: Number(row.evidence_count),
      evidenceCoverage,
      evidenceConfidence,
      evidence
    };
    if (sourceCount < 2 || independentSourceCount < 1) {
      exclusions.push({ productVersionId: base.productVersionId, name: base.name, reason: 'Requires at least two sources including one independent source' });
    } else products.push(base);
  }
  return { products, exclusions };
}

function modelInput(products: EditorialInput[]) {
  return products.map((product) => {
    const rubric = getRubric(product.categoryKey as Parameters<typeof getRubric>[0]);
    return {
      productVersionId: product.productVersionId,
      name: product.name,
      brand: product.brand,
      modelVersion: product.modelVersion,
      categoryKey: product.categoryKey,
      trailgenicUseCase: rubric.useCase,
      dimensions: rubric.dimensions.map(({ key,label,description,weight }) => ({ key,label,description,weight })),
      evidenceConfidence: product.evidenceConfidence,
      evidenceCoverage: product.evidenceCoverage,
      sources: product.evidence
    };
  });
}

const editorialInstructions = `You are the TrailGenic Gear Intelligence scorer. Preserve the original TrailGenic report contract.
TG Score and every category sub-score are deliberately subjective TrailGenic house judgments. They do not need to be independently reproducible, and they are not scientific measurements, medical claims, consumer averages, or universal rankings.
Use the supplied sourced facts and observations as inputs, then apply TrailGenic's fasted high-altitude longevity lens. Ignore aesthetics, brand prestige, lifestyle marketing, and generic comfort that has no altitude, load, recovery, or protocol relevance. Do not invent product specifications.
For each product, assign one TG composite score from 0 to 100 and select exactly four or five relevant sub-scores from this original report vocabulary: Metabolic Load, Recovery Impact, Altitude Readiness, Longevity Protocol Fit, Field Durability, Pack Weight Economics, and Electrolyte/Nutrition Score. Electrolyte/Nutrition Score is only for supplements. Each sub-score needs a specific editorial field note grounded in the supplied inputs.
Write a two-sentence field verdict explaining the TrailGenic judgment, including the main benefit and the material limitation. Write one concise protocol note about fasted high-altitude compatibility. Evidence confidence is supplied for context only and must never determine or validate the TG Score. Return exactly one result for every supplied productVersionId.`;

async function scoreEditorialBatch(products: EditorialInput[],apiKey: string,model: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`,'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,reasoning: { effort: 'low' },instructions: editorialInstructions,
        input: JSON.stringify({ editorialPerspective: 'TrailGenic Method',products: modelInput(products) }),
        text: { format: { type: 'json_schema',name: 'trailgenic_editorial_scores',strict: true,schema: editorialJsonSchema } },
        max_output_tokens: 5000
      })
    });
    if (!response.ok) throw new Error(`OpenAI editorial scoring failed (${response.status})`);
    const payload = await response.json() as {
      model?: string;output_text?: string;
      output?: Array<{ content?: Array<{ type?: string;text?: string }> }>;
      usage?: { input_tokens?: number;output_tokens?: number };
    };
    const outputText = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === 'output_text')?.text;
    if (!outputText) throw new Error('Editorial scoring returned no structured output');
    return { scored: EditorialOutputSchema.parse(JSON.parse(outputText)),payload };
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateEditorialReport(pipelineRunId?: string) {
  const now = new Date();
  const quarter = quarterForDate(now);
  const evidenceCutoff = now.toISOString().slice(0, 10);
  const { products, exclusions } = await loadEditorialInputs();
  if (!products.length) return { published: false, reason: 'No products have sufficient sourced evidence', exclusions };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for editorial scoring');
  const model = process.env.OPENAI_EDITORIAL_MODEL ?? process.env.OPENAI_EXTRACTION_MODEL ?? 'gpt-5.6-luna';
  const run = await getPool().query({
    text: `INSERT INTO editorial_runs
             (pipeline_run_id,quarter,evidence_cutoff,provider,model,prompt_version)
           VALUES ($1,$2,$3,'openai',$4,$5) RETURNING id`,
    values: [pipelineRunId ?? null,quarter,evidenceCutoff,model,promptVersion]
  });
  const runId = run.rows[0]?.id as string;
  try {
    const batches: EditorialInput[][] = [];
    for (let index=0;index<products.length;index+=8) batches.push(products.slice(index,index+8));
    const batchResults = await Promise.all(batches.map((batch) => scoreEditorialBatch(batch,apiKey,model)));
    const scored = { products: batchResults.flatMap((batch) => batch.scored.products) };
    const responsePayload = {
      model: batchResults.map((batch) => batch.payload.model).find(Boolean) ?? model,
      usage: {
        input_tokens: batchResults.reduce((sum,batch) => sum+(batch.payload.usage?.input_tokens ?? 0),0),
        output_tokens: batchResults.reduce((sum,batch) => sum+(batch.payload.usage?.output_tokens ?? 0),0)
      }
    };
    const inputById = new Map(products.map((product) => [product.productVersionId, product]));
    const unique = new Set(scored.products.map((product) => product.productVersionId));
    if (unique.size !== products.length || scored.products.length !== products.length || scored.products.some((score) => !inputById.has(score.productVersionId))) {
      throw new Error('Editorial scoring did not return the complete product slate');
    }
    const normalizedScores = scored.products.map((score) => ({
      ...score,
      // The score is the editorial judgment; labels are deterministic display bands.
      fitLabel: fitLabelForScore(score.tgScore)
    }));
    const publicProducts = normalizedScores.map((score) => {
      const product = inputById.get(score.productVersionId)!;
      const sources = [...new Map(product.evidence.map((claim) => [claim.sourceId, {
        url: claim.url,title: claim.title,publisher: new URL(claim.url).hostname.replace(/^www\./,''),sourceType: claim.sourceType
      }])).values()];
      return {
        productVersionId: score.productVersionId,
        name: product.name,
        modelVersion: product.modelVersion,
        categoryKey: product.categoryKey,
        fitScore: score.tgScore,
        confidence: product.evidenceConfidence,
        evidenceCoverage: product.evidenceCoverage,
        evidenceState: product.evidenceConfidence >= 0.7 ? 'supported' : 'preliminary',
        fitLabel: score.fitLabel,
        summary: score.verdict,
        protocolNote: score.protocolNote,
        scores: score.scores,
        sources,
        sourceCount: product.sourceCount,
        evidenceCount: product.evidenceCount
      };
    }).sort((a,b) => b.fitScore-a.fitScore || a.name.localeCompare(b.name));

    const report = await withTransaction(async (client) => {
      for (const score of normalizedScores) {
        const product = inputById.get(score.productVersionId)!;
        await client.query({
          text: `INSERT INTO editorial_scores
                   (editorial_run_id,product_version_id,tg_score,fit_label,rationale,limitations,strengths,cautions,
                    evidence_confidence,evidence_coverage,source_count,evidence_count,dimension_scores,protocol_note)
                 VALUES ($1,$2,$3,$4,$5,'','[]','[]',$6,$7,$8,$9,$10,$11)`,
          values: [runId,score.productVersionId,score.tgScore,score.fitLabel,score.verdict,
            product.evidenceConfidence,product.evidenceCoverage,product.sourceCount,product.evidenceCount,
            JSON.stringify(score.scores),score.protocolNote]
        });
        await client.query(`UPDATE products SET status='active',updated_at=now() WHERE id=(SELECT product_id FROM product_versions WHERE id=$1)`, [score.productVersionId]);
      }
      const reportPayload = {
        reportType: 'TrailGenic Gear Intelligence',
        title: `Gear Intelligence Report — ${quarter}`,
        quarter,
        evidenceCutoff,
        generatedAt: now.toISOString(),
        rubricVersion: 'TrailGenic longevity lens / original report contract',
        methodology: 'Public product and review signals rescored through TrailGenic’s subjective longevity, fasted-hiking, altitude, recovery, and protocol-fit lens.',
        version: `${quarter.replace(/^(\d{4})-Q([1-4])$/,'Q$2-$1')}.1`,
        approvedBy: 'TrailGenic automated editorial policy v1',
        model: responsePayload.model ?? model,
        promptVersion,
        products: publicProducts,
        exclusions
      };
      const slug = `gear-intelligence-${quarter.toLowerCase()}-${runId.slice(0,8)}`;
      const snapshot = await client.query({
        text: `INSERT INTO report_snapshots (slug,title,quarter,evidence_cutoff,rubric_version,approved_by,payload)
               VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        values: [slug,reportPayload.title,quarter,evidenceCutoff,reportPayload.rubricVersion,reportPayload.approvedBy,JSON.stringify(reportPayload)]
      });
      await client.query({
        text: `UPDATE editorial_runs SET status='complete',model=$1,input_tokens=$2,output_tokens=$3,
               metadata=$4,completed_at=now() WHERE id=$5`,
        values: [reportPayload.model,responsePayload.usage?.input_tokens ?? null,responsePayload.usage?.output_tokens ?? null,
          JSON.stringify({ products: publicProducts.length,exclusions }),runId]
      });
      return { id: snapshot.rows[0]?.id as string,slug,payload: reportPayload };
    });
    return { published: true,runId,...report };
  } catch (error) {
    await getPool().query(`UPDATE editorial_runs SET status='failed',metadata=$1,completed_at=now() WHERE id=$2`, [
      JSON.stringify({ error: error instanceof Error ? error.message : 'unknown' }),runId
    ]);
    throw error;
  }
}

export { fitLabelForScore, promptVersion as EDITORIAL_PROMPT_VERSION };
