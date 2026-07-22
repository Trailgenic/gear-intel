import {
  DiscoveryCandidateSchema,
  DiscoveryOutputSchema,
  type CandidateReview,
  type DiscoveryCandidate
} from '../domain/schemas.js';
import { getPool, withTransaction } from '../db/client.js';

const promptVersion = 'product-discovery-v3';
const blockedEvidenceHosts = new Set(['sec.gov', 'www.sec.gov']);

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

function normalizeUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || key.toLowerCase() === 'srsltid') url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.toString();
}

function verifiedCandidate(candidate: DiscoveryCandidate, consultedRaw: Set<string>): DiscoveryCandidate | null {
  const consulted = new Set([...consultedRaw].map(normalizeUrl));
  const officialUrl = candidate.officialUrl ? normalizeUrl(candidate.officialUrl) : null;
  const evidenceUrls = [...new Set(candidate.evidenceUrls.map(normalizeUrl)
    .filter((url) => consulted.has(url) && !blockedEvidenceHosts.has(new URL(url).hostname.toLowerCase())))];
  if (officialUrl && consulted.has(officialUrl) && !evidenceUrls.includes(officialUrl)) evidenceUrls.unshift(officialUrl);
  if (evidenceUrls.length < 2) return null;
  const hosts = new Set(evidenceUrls.map((url) => new URL(url).hostname.toLowerCase()));
  if (hosts.size < 2) return null;
  if (officialUrl) {
    if (!evidenceUrls.includes(officialUrl)) return null;
    const officialHost = new URL(officialUrl).hostname.toLowerCase();
    if (![...hosts].some((host) => host !== officialHost)) return null;
  }
  return DiscoveryCandidateSchema.parse({
    ...candidate,
    officialUrl,
    evidenceUrls,
    trendScore: Math.round(candidate.trendScore / 5) * 5
  });
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
        instructions: `Find current hiking products with credible recent attention and plausible relevance to the TrailGenic Method.
Search all eight categories. Return no more than four strong candidates per category.
Use an exact current manufacturer product page plus at least one independent page that explicitly names and discusses that exact product. Never use a generic category page, search page, corporate filing, quick-start index, or source that merely discusses the brand or category.
Use an exact release year, generation, or manufacturer model identifier for modelVersion. Never call an older product new or label a version merely "current model". Distinguish a genuine release from an established product receiving new independent testing.
Every material, weight, formulation, and performance statement must be supported by the supplied exact-product URLs. If sources conflict, say so in rationale rather than resolving the conflict yourself.
Trend score is rough discovery priority only: use increments of five. It never represents protocol fit, product quality, or an endorsement. Do not score TrailGenic suitability.
Do not invent URLs, model names, specifications, release dates, testing, or popularity. Omit a candidate if exact-product evidence is inadequate.`,
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
      .map((candidate) => verifiedCandidate(candidate, consulted))
      .filter((candidate): candidate is DiscoveryCandidate => candidate !== null);
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
  const result = await getPool().query(`SELECT * FROM product_candidates WHERE status IN ('pending','held') ORDER BY trend_score DESC,created_at DESC`);
  return result.rows;
}

function reviewedCandidate(candidate: Record<string, unknown>, review: CandidateReview): DiscoveryCandidate {
  const corrections = review.corrections;
  const effective = DiscoveryCandidateSchema.parse({
    categoryKey: corrections.categoryKey ?? candidate.category_key,
    brand: corrections.brand ?? candidate.brand,
    productName: corrections.productName ?? candidate.product_name,
    modelVersion: corrections.modelVersion ?? candidate.model_version,
    officialUrl: corrections.officialUrl !== undefined ? corrections.officialUrl : candidate.official_url,
    rationale: corrections.rationale ?? candidate.rationale,
    evidenceUrls: corrections.evidenceUrls ?? candidate.evidence_urls,
    trendSignals: corrections.trendSignals ?? candidate.trend_signals,
    trendScore: Number(candidate.trend_score)
  });
  if (!effective.officialUrl) throw new Error('Accepted candidate requires an exact official product URL');
  if (/^(current|new|new\/current)(\s|$)/i.test(effective.modelVersion) || /current product line/i.test(effective.modelVersion)) {
    throw new Error('Accepted candidate requires a specific model version');
  }
  const official = normalizeUrl(effective.officialUrl);
  const evidence = effective.evidenceUrls.map(normalizeUrl);
  if (!evidence.includes(official)) throw new Error('Accepted candidate evidence must include the official product URL');
  const officialHost = new URL(official).hostname.toLowerCase();
  if (!evidence.some((url) => new URL(url).hostname.toLowerCase() !== officialHost)) {
    throw new Error('Accepted candidate requires independent exact-product evidence');
  }
  return { ...effective, officialUrl: official, evidenceUrls: [...new Set(evidence)] };
}

export async function reviewCandidates(reviews: CandidateReview[]) {
  return withTransaction(async (client) => {
    const output: Array<{ candidateId: string; decision: string; productVersionId: string | null }> = [];
    for (const review of reviews) {
      const result = await client.query('SELECT * FROM product_candidates WHERE id=$1 FOR UPDATE', [review.candidateId]);
      const candidate = result.rows[0] as Record<string, unknown> | undefined;
      if (!candidate) throw new Error('Candidate not found');
      const currentStatus = String(candidate.status);
      if (!['pending', 'held'].includes(currentStatus) && currentStatus !== review.decision) {
        throw new Error(`Candidate is already ${currentStatus}`);
      }

      let productVersionId: string | null = null;
      if (review.decision === 'accepted') {
        const effective = reviewedCandidate(candidate, review);
        const category = await client.query('SELECT id FROM categories WHERE key=$1', [effective.categoryKey]);
        const categoryId = category.rows[0]?.id as string | undefined;
        if (!categoryId) throw new Error('Candidate category is not configured');
        const product = await client.query({
          text: `INSERT INTO products (brand,product_family,category_id,status) VALUES ($1,$2,$3,'candidate')
                 ON CONFLICT (brand,product_family,category_id) DO UPDATE SET updated_at=now() RETURNING id`,
          values: [effective.brand, effective.productName, categoryId]
        });
        const version = await client.query({
          text: `INSERT INTO product_versions (product_id,model_version,display_name,manufacturer_url)
                 VALUES ($1,$2,$3,$4)
                 ON CONFLICT (product_id,model_version) DO UPDATE SET
                   display_name=EXCLUDED.display_name,manufacturer_url=EXCLUDED.manufacturer_url,updated_at=now()
                 RETURNING id`,
          values: [product.rows[0]?.id, effective.modelVersion, `${effective.brand} ${effective.productName}`, effective.officialUrl]
        });
        productVersionId = version.rows[0]?.id as string;
      }

      await client.query({
        text: `UPDATE product_candidates SET status=$1,reviewed_by=$2,reviewed_at=now(),review_note=$3,review_corrections=$4 WHERE id=$5`,
        values: [review.decision, review.reviewer, review.note, JSON.stringify(review.corrections), review.candidateId]
      });
      output.push({ candidateId: review.candidateId, decision: review.decision, productVersionId });
    }
    return output;
  });
}

export async function promoteCandidate(candidateId: string, reviewer: string): Promise<string> {
  const [result] = await reviewCandidates([{ candidateId, reviewer, decision: 'accepted', note: '', corrections: {} }]);
  if (!result?.productVersionId) throw new Error('Candidate promotion failed');
  return result.productVersionId;
}
