import { z } from 'zod';
import { getPool, withTransaction } from '../db/client.js';
import { getRubric } from '../rubrics/index.js';

const promptVersion = 'trailgenic-editorial-score-v1';

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
    fitLabel: z.enum(['strong','conditional','limited']),
    rationale: z.string().trim().min(1).max(1200),
    limitations: z.string().trim().max(1000),
    strengths: z.array(z.string().trim().min(1).max(240)).max(5),
    cautions: z.array(z.string().trim().min(1).max(240)).max(5)
  })).max(40)
});

const editorialJsonSchema = {
  type: 'object', additionalProperties: false, required: ['products'],
  properties: {
    products: {
      type: 'array', maxItems: 40,
      items: {
        type: 'object', additionalProperties: false,
        required: ['productVersionId','tgScore','fitLabel','rationale','limitations','strengths','cautions'],
        properties: {
          productVersionId: { type: 'string' },
          tgScore: { type: 'integer', minimum: 0, maximum: 100 },
          fitLabel: { type: 'string', enum: ['strong','conditional','limited'] },
          rationale: { type: 'string' }, limitations: { type: 'string' },
          strengths: { type: 'array', maxItems: 5, items: { type: 'string' } },
          cautions: { type: 'array', maxItems: 5, items: { type: 'string' } }
        }
      }
    }
  }
} as const;

const round = (value: number) => Math.round(value * 100) / 100;

export function quarterForDate(date: Date): string {
  return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

export function fitLabelForScore(score: number): 'strong' | 'conditional' | 'limited' {
  if (score >= 75) return 'strong';
  if (score >= 55) return 'conditional';
  return 'limited';
}

async function loadEditorialInputs(limit = 40): Promise<{ products: EditorialInput[]; exclusions: unknown[] }> {
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55_000);
    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST', signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model, reasoning: { effort: 'low' },
          instructions: `You are the TrailGenic Gear Intelligence editorial scorer.
TG Score is deliberately a subjective house assessment of product fit for the TrailGenic Method. It is not a scientific measurement, consumer popularity score, medical claim, or universal ranking.
Use only the supplied sourced facts and observations. Apply the stated TrailGenic use case and weighted category dimensions as editorial priorities. Manufacturer claims are weaker than independent observations and controlled tests. Do not invent specifications or outcomes.
Score consistently across the supplied slate from 0 to 100. Use strong for 75-100, conditional for 55-74, and limited for 0-54. Explain why the product fits our method, when it does not, and the conditions that materially change the judgment. Evidence confidence is supplied separately and must not be treated as the TG Score. Return exactly one result for every supplied productVersionId.`,
          input: JSON.stringify({ editorialPerspective: 'TrailGenic Method', products: modelInput(products) }),
          text: { format: { type: 'json_schema', name: 'trailgenic_editorial_scores', strict: true, schema: editorialJsonSchema } },
          max_output_tokens: 8000
        })
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new Error(`OpenAI editorial scoring failed (${response.status})`);
    const responsePayload = await response.json() as {
      model?: string; output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const outputText = responsePayload.output_text ?? responsePayload.output?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === 'output_text')?.text;
    if (!outputText) throw new Error('Editorial scoring returned no structured output');
    const scored = EditorialOutputSchema.parse(JSON.parse(outputText));
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
        summary: score.rationale,
        limitations: score.limitations,
        strengths: score.strengths,
        cautions: score.cautions,
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
                    evidence_confidence,evidence_coverage,source_count,evidence_count)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          values: [runId,score.productVersionId,score.tgScore,score.fitLabel,score.rationale,score.limitations,
            JSON.stringify(score.strengths),JSON.stringify(score.cautions),product.evidenceConfidence,
            product.evidenceCoverage,product.sourceCount,product.evidenceCount]
        });
        await client.query(`UPDATE products SET status='active',updated_at=now() WHERE id=(SELECT product_id FROM product_versions WHERE id=$1)`, [score.productVersionId]);
      }
      const reportPayload = {
        reportType: 'TrailGenic Gear Intelligence Editorial Index',
        title: `Gear Intelligence Report — ${quarter}`,
        quarter,
        evidenceCutoff,
        generatedAt: now.toISOString(),
        rubricVersion: 'TrailGenic editorial lens v1 / category rubrics 2.0.0',
        methodology: 'TG Score is a subjective TrailGenic editorial assessment of protocol fit, generated from sourced product facts and observations. It is not a universal or independently reproducible performance measurement.',
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

export { promptVersion as EDITORIAL_PROMPT_VERSION };
