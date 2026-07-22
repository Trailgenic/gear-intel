import { DiscoveryOutputSchema, type DiscoveryCandidate } from '../domain/schemas.js';
import { getPool, withTransaction } from '../db/client.js';

const promptVersion = 'product-discovery-v2';

const discoverySchema = {
  type: 'object', additionalProperties: false, required: ['candidates'],
  properties: {
    candidates: {
      type: 'array', maxItems: 40,
      items: {
        type: 'object', additionalProperties: false,
        required: ['categoryKey','brand','productName','modelVersion','officialUrl','rationale','trendSignals','evidenceUrls','trendScore'],
        properties: {
          categoryKey: { type: 'string', enum: ['backpacks','trail-shoes','insulation','trekking-poles','electrolytes','hydration','shell-rain','headlamps'] },
          brand: { type: 'string' }, productName: { type: 'string' }, modelVersion: { type: 'string' },
          officialUrl: { type: ['string','null'] }, rationale: { type: 'string' },
          trendSignals: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'string' } },
          evidenceUrls: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'string' } },
          trendScore: { type: 'number', minimum: 0, maximum: 100 }
        }
      }
    }
  }
} as const;

function collectSourceUrls(value: unknown, urls = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((item) => collectSourceUrls(item, urls));
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if ((key === 'url' || key === 'link') && typeof child === 'string' && /^https:\/\//.test(child)) urls.add(child);
      else collectSourceUrls(child, urls);
    }
  }
  return urls;
}

export async function discoverProducts(): Promise<{ runId: string; candidates: number; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for product discovery');
  const model = process.env.OPENAI_DISCOVERY_MODEL ?? process.env.OPENAI_EXTRACTION_MODEL ?? 'gpt-5.6-luna';
  const run = await getPool().query({
    text: `INSERT INTO discovery_runs (provider,model,prompt_version) VALUES ('openai',$1,$2) RETURNING id`,
    values: [model, promptVersion]
  });
  const runId = run.rows[0]?.id as string;
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        reasoning: { effort: 'low' },
        tools: [{ type: 'web_search' }],
        tool_choice: 'auto',
        include: ['web_search_call.action.sources'],
        instructions: `Find current or newly released hiking products with credible momentum and plausible relevance to the TrailGenic Method.
Search all eight categories. Prefer current manufacturer pages plus independent expert or community signals. Return no more than four strong candidates per category.
Trend score measures freshness and current attention only. It must never represent protocol fit. Do not score TrailGenic suitability.
Every candidate requires at least two recent evidence URLs where possible, including an official page when available. Do not invent URLs, product versions, specifications, or release dates.`,
        input: `Run a current product-discovery scan as of ${new Date().toISOString().slice(0,10)} for backpacks, trail shoes, insulation, trekking poles, electrolytes, hydration systems, shells/rain protection, and headlamps.`,
        text: { format: { type: 'json_schema', name: 'trailgenic_product_discovery', strict: true, schema: discoverySchema } },
        max_output_tokens: 7000
      })
    });
    if (!response.ok) throw new Error(`OpenAI discovery failed (${response.status})`);
    const payload = await response.json() as {
      output_text?: string;
      output?: unknown[];
      usage?: { input_tokens?: number; output_tokens?: number };
      model?: string;
    };
    const outputText = payload.output_text ?? (payload.output as Array<{ content?: Array<{ type?: string; text?: string }> }> | undefined)
      ?.flatMap((item) => item.content ?? []).find((item) => item.type === 'output_text')?.text;
    if (!outputText) throw new Error('Discovery returned no structured output');
    const parsed = DiscoveryOutputSchema.parse(JSON.parse(outputText));
    const consulted = collectSourceUrls(payload.output);
    const candidates = parsed.candidates
      .map((candidate) => ({ ...candidate, evidenceUrls: candidate.evidenceUrls.filter((url) => consulted.has(url)) }))
      .filter((candidate) => candidate.evidenceUrls.length > 0);
    if (!candidates.length) throw new Error('Discovery produced no source-grounded candidates');
    await saveCandidates(runId, candidates, payload.usage);
    return { runId, candidates: candidates.length, model: payload.model ?? model };
  } catch (error) {
    await getPool().query('UPDATE discovery_runs SET status=$1,completed_at=now(),metadata=$2 WHERE id=$3', [
      'failed', JSON.stringify({ error: error instanceof Error ? error.message : 'unknown' }), runId
    ]);
    throw error;
  }
}

async function saveCandidates(
  runId: string,
  candidates: DiscoveryCandidate[],
  usage?: { input_tokens?: number; output_tokens?: number }
) {
  await withTransaction(async (client) => {
    for (const candidate of candidates) {
      await client.query({
        text: `INSERT INTO product_candidates
                 (discovery_run_id,category_key,brand,product_name,model_version,official_url,rationale,evidence_urls,trend_signals,trend_score)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
               ON CONFLICT (category_key,brand,product_name,model_version) DO UPDATE SET
                 discovery_run_id=EXCLUDED.discovery_run_id,official_url=EXCLUDED.official_url,rationale=EXCLUDED.rationale,
                 evidence_urls=EXCLUDED.evidence_urls,trend_signals=EXCLUDED.trend_signals,trend_score=EXCLUDED.trend_score,
                 status=CASE WHEN product_candidates.status='accepted' THEN 'accepted' ELSE 'pending' END`,
        values: [runId,candidate.categoryKey,candidate.brand,candidate.productName,candidate.modelVersion,candidate.officialUrl,
          candidate.rationale,JSON.stringify(candidate.evidenceUrls),JSON.stringify(candidate.trendSignals),candidate.trendScore]
      });
    }
    await client.query({
      text: `UPDATE discovery_runs SET status='complete',completed_at=now(),input_tokens=$1,output_tokens=$2 WHERE id=$3`,
      values: [usage?.input_tokens ?? null, usage?.output_tokens ?? null, runId]
    });
  });
}

export async function listCandidates() {
  const result = await getPool().query(`SELECT * FROM product_candidates WHERE status='pending' ORDER BY trend_score DESC,created_at DESC`);
  return result.rows;
}

export async function promoteCandidate(candidateId: string, reviewer: string): Promise<string> {
  return withTransaction(async (client) => {
    const result = await client.query('SELECT * FROM product_candidates WHERE id=$1 AND status=$2 FOR UPDATE', [candidateId, 'pending']);
    const candidate = result.rows[0];
    if (!candidate) throw new Error('Pending candidate not found');
    const category = await client.query('SELECT id FROM categories WHERE key=$1', [candidate.category_key]);
    const categoryId = category.rows[0]?.id as string | undefined;
    if (!categoryId) throw new Error('Candidate category is not configured');
    const product = await client.query({
      text: `INSERT INTO products (brand,product_family,category_id,status) VALUES ($1,$2,$3,'candidate')
             ON CONFLICT (brand,product_family,category_id) DO UPDATE SET updated_at=now() RETURNING id`,
      values: [candidate.brand,candidate.product_name,categoryId]
    });
    const version = await client.query({
      text: `INSERT INTO product_versions (product_id,model_version,display_name,manufacturer_url)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (product_id,model_version) DO UPDATE SET manufacturer_url=EXCLUDED.manufacturer_url,updated_at=now()
             RETURNING id`,
      values: [product.rows[0]?.id,candidate.model_version,`${candidate.brand} ${candidate.product_name}`,candidate.official_url]
    });
    await client.query('UPDATE product_candidates SET status=$1,reviewed_by=$2,reviewed_at=now() WHERE id=$3', ['accepted',reviewer,candidateId]);
    return version.rows[0]?.id as string;
  });
}
