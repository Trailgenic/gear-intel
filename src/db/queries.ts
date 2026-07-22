import type pg from 'pg';
import type { AssessmentResult, RubricDefinition, ScoringEvidence } from '../domain/rubric.js';
import type { CategoryKey, EvidenceExtraction } from '../domain/schemas.js';
import { getPool, withTransaction } from './client.js';

export interface ProductRecord {
  id: string;
  productVersionId: string;
  brand: string;
  productFamily: string;
  modelVersion: string;
  displayName: string;
  categoryKey: CategoryKey;
  status: string;
  manufacturerUrl: string | null;
  specifications: Record<string, unknown>;
}

export async function listProducts(category?: CategoryKey): Promise<ProductRecord[]> {
  const values: unknown[] = [];
  const where = category ? 'WHERE c.key = $1' : '';
  if (category) values.push(category);
  const result = await getPool().query({
    text: `SELECT p.id, pv.id AS product_version_id, p.brand, p.product_family, pv.model_version,
                  pv.display_name, c.key AS category_key, p.status, pv.manufacturer_url, pv.specifications
           FROM products p
           JOIN categories c ON c.id = p.category_id
           JOIN product_versions pv ON pv.product_id = p.id
           ${where}
           ORDER BY c.label, p.brand, pv.display_name`,
    values
  });
  return result.rows.map((row) => ({
    id: row.id as string,
    productVersionId: row.product_version_id as string,
    brand: row.brand as string,
    productFamily: row.product_family as string,
    modelVersion: row.model_version as string,
    displayName: row.display_name as string,
    categoryKey: row.category_key as CategoryKey,
    status: row.status as string,
    manufacturerUrl: row.manufacturer_url as string | null,
    specifications: row.specifications as Record<string, unknown>
  }));
}

export async function createProduct(input: {
  brand: string;
  productFamily: string;
  modelVersion: string;
  displayName: string;
  categoryKey: CategoryKey;
  manufacturerUrl?: string;
  specifications: Record<string, unknown>;
}): Promise<string> {
  return withTransaction(async (client) => {
    const category = await client.query('SELECT id FROM categories WHERE key=$1', [input.categoryKey]);
    const categoryId = category.rows[0]?.id as string | undefined;
    if (!categoryId) throw new Error('Candidate category is not configured');
    const product = await client.query({
      text: `INSERT INTO products (brand,product_family,category_id,status) VALUES ($1,$2,$3,'candidate')
             ON CONFLICT (brand,product_family,category_id) DO UPDATE SET updated_at=now() RETURNING id`,
      values: [input.brand,input.productFamily,categoryId]
    });
    const version = await client.query({
      text: `INSERT INTO product_versions (product_id,model_version,display_name,manufacturer_url,specifications)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (product_id,model_version) DO UPDATE SET display_name=EXCLUDED.display_name,
               manufacturer_url=EXCLUDED.manufacturer_url,specifications=EXCLUDED.specifications,updated_at=now()
             RETURNING id`,
      values: [product.rows[0]?.id,input.modelVersion,input.displayName,input.manufacturerUrl ?? null,JSON.stringify(input.specifications)]
    });
    return version.rows[0]?.id as string;
  });
}

export async function getProductVersion(id: string): Promise<ProductRecord | null> {
  const result = await getPool().query({
    text: `SELECT p.id, pv.id AS product_version_id, p.brand, p.product_family, pv.model_version,
                  pv.display_name, c.key AS category_key, p.status, pv.manufacturer_url, pv.specifications
           FROM product_versions pv
           JOIN products p ON p.id = pv.product_id
           JOIN categories c ON c.id = p.category_id
           WHERE pv.id = $1`,
    values: [id]
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id as string,
    productVersionId: row.product_version_id as string,
    brand: row.brand as string,
    productFamily: row.product_family as string,
    modelVersion: row.model_version as string,
    displayName: row.display_name as string,
    categoryKey: row.category_key as CategoryKey,
    status: row.status as string,
    manufacturerUrl: row.manufacturer_url as string | null,
    specifications: row.specifications as Record<string, unknown>
  };
}

export async function saveSourceExtraction(input: {
  productVersionId: string;
  url: string;
  publisher: string;
  sourceType: string;
  title: string;
  publishedAt?: string;
  evidenceCutoff?: string;
  contentHash: string;
  model: string;
  promptVersion: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  extraction: EvidenceExtraction;
  reliability: number;
}): Promise<{ sourceId: string; snapshotId: string; evidenceIds: string[] }> {
  return withTransaction(async (client) => {
    const source = await client.query({
      text: `INSERT INTO sources (url, publisher, source_type, title, published_at, last_retrieved_at)
             VALUES ($1,$2,$3,$4,$5,now())
             ON CONFLICT (url) DO UPDATE SET publisher=EXCLUDED.publisher, source_type=EXCLUDED.source_type,
               title=EXCLUDED.title, published_at=COALESCE(EXCLUDED.published_at,sources.published_at), last_retrieved_at=now()
             RETURNING id`,
      values: [input.url, input.publisher, input.sourceType, input.title, input.publishedAt ?? null]
    });
    const sourceId = source.rows[0]?.id as string;
    const snapshot = await client.query({
      text: `INSERT INTO source_snapshots
               (source_id, content_hash, evidence_cutoff, http_status, extraction_model, prompt_version, input_tokens, output_tokens, metadata)
             VALUES ($1,$2,$3,200,$4,$5,$6,$7,$8)
             ON CONFLICT (source_id, content_hash) DO UPDATE SET metadata=EXCLUDED.metadata
             RETURNING id`,
      values: [sourceId, input.contentHash, input.evidenceCutoff ?? null, input.model, input.promptVersion,
        input.usage?.inputTokens ?? null, input.usage?.outputTokens ?? null,
        JSON.stringify({ productMatch: input.extraction.productMatch, conflictsOrWarnings: input.extraction.conflictsOrWarnings })]
    });
    const snapshotId = snapshot.rows[0]?.id as string;
    const evidenceIds: string[] = [];
    for (const claim of input.extraction.claims) {
      const inserted = await client.query({
        text: `INSERT INTO evidence_items
                 (product_version_id, source_snapshot_id, dimension_key, claim, excerpt, signal, strength, reliability, applicability, limitations)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        values: [input.productVersionId, snapshotId, claim.dimensionKey, claim.claim, claim.excerpt,
          claim.signal, claim.strength, input.reliability, claim.applicability, claim.limitations]
      });
      evidenceIds.push(inserted.rows[0]?.id as string);
    }
    return { sourceId, snapshotId, evidenceIds };
  });
}

export async function getVerifiedEvidence(productVersionId: string, evidenceCutoff: string): Promise<ScoringEvidence[]> {
  const result = await getPool().query({
    text: `SELECT ei.id, ei.dimension_key, ei.signal, ei.strength, ei.reliability, ei.applicability, ss.source_id
           FROM evidence_items ei
           JOIN source_snapshots ss ON ss.id = ei.source_snapshot_id
           JOIN sources s ON s.id=ss.source_id
           WHERE ei.product_version_id = $1 AND ei.verification_state = 'verified'
             AND COALESCE(s.published_at,ss.evidence_cutoff,ss.retrieved_at::date) <= $2::date`,
    values: [productVersionId, evidenceCutoff]
  });
  return result.rows.map((row) => ({
    id: row.id as string,
    dimensionKey: row.dimension_key as string,
    signal: row.signal as ScoringEvidence['signal'],
    strength: Number(row.strength),
    reliability: Number(row.reliability),
    applicability: Number(row.applicability),
    sourceId: row.source_id as string
  }));
}

export async function getEvidenceContext(productVersionId: string, evidenceCutoff: string): Promise<{
  hasConflicts: boolean;
  narrative: Array<{ claim: string; excerpt: string; dimensionKey: string; signal: string; sourceUrl: string }>;
}> {
  const result = await getPool().query({
    text: `SELECT ei.claim,ei.excerpt,ei.dimension_key,ei.signal,ei.verification_state,s.url
           FROM evidence_items ei
           JOIN source_snapshots ss ON ss.id=ei.source_snapshot_id
           JOIN sources s ON s.id=ss.source_id
           WHERE ei.product_version_id=$1 AND ei.verification_state IN ('verified','conflicting')
             AND COALESCE(s.published_at,ss.evidence_cutoff,ss.retrieved_at::date) <= $2::date
           ORDER BY ei.dimension_key,ei.created_at`,
    values: [productVersionId, evidenceCutoff]
  });
  return {
    hasConflicts: result.rows.some((row) => row.verification_state === 'conflicting'),
    narrative: result.rows.filter((row) => row.verification_state === 'verified').map((row) => ({
      claim: row.claim as string,
      excerpt: row.excerpt as string,
      dimensionKey: row.dimension_key as string,
      signal: row.signal as string,
      sourceUrl: row.url as string
    }))
  };
}

export async function createAssessment(input: {
  productVersionId: string;
  rubric: RubricDefinition;
  result: AssessmentResult;
  evidence: ScoringEvidence[];
  summary: string;
  limitations: string;
  evidenceCutoff: string;
  quarter?: string;
  runType: 'manual' | 'weekly_refresh' | 'quarterly' | 'reassessment';
  runId?: string;
}): Promise<string> {
  return withTransaction(async (client: pg.PoolClient) => {
    let runId = input.runId;
    const createdRun = !runId;
    if (!runId) {
      const run = await client.query({
        text: `INSERT INTO assessment_runs
                 (run_type, quarter, evidence_cutoff, code_version, provider, extraction_model, prompt_version, status, started_at)
               VALUES ($1,$2,$3,$4,'openai',$5,$6,'running',now()) RETURNING id`,
        values: [input.runType, input.quarter ?? null, input.evidenceCutoff, process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
          process.env.OPENAI_EXTRACTION_MODEL ?? 'gpt-5.6-luna', 'evidence-extraction-v2']
      });
      runId = run.rows[0]?.id as string;
    }
    const rubricRow = await client.query({
      text: `SELECT rv.id FROM rubric_versions rv JOIN categories c ON c.id=rv.category_id
             WHERE c.key=$1 AND rv.version=$2`,
      values: [input.rubric.categoryKey, input.rubric.version]
    });
    const rubricVersionId = rubricRow.rows[0]?.id as string | undefined;
    if (!rubricVersionId) throw new Error(`Rubric ${input.rubric.categoryKey}@${input.rubric.version} is not seeded`);
    const assessment = await client.query({
      text: `INSERT INTO assessments
               (run_id, product_version_id, rubric_version_id, fit_score, confidence, evidence_coverage, evidence_state, fit_label, summary, limitations)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      values: [runId, input.productVersionId, rubricVersionId, input.result.fitScore, input.result.confidence,
        input.result.evidenceCoverage, input.result.evidenceState, input.result.fitLabel, input.summary, input.limitations]
    });
    const assessmentId = assessment.rows[0]?.id as string;
    for (const dimension of input.result.dimensions) {
      await client.query({
        text: `INSERT INTO assessment_dimensions
                 (assessment_id,dimension_key,label,score,confidence,evidence_count,source_count)
               VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        values: [assessmentId, dimension.key, dimension.label, dimension.score, dimension.confidence, dimension.evidenceCount, dimension.sourceCount]
      });
    }
    for (const evidence of input.evidence) {
      await client.query({
        text: 'INSERT INTO assessment_evidence (assessment_id,evidence_item_id) VALUES ($1,$2)',
        values: [assessmentId, evidence.id]
      });
    }
    if (createdRun) {
      await client.query("UPDATE assessment_runs SET status='complete',completed_at=now() WHERE id=$1", [runId]);
    }
    return assessmentId;
  });
}

export async function verifyEvidence(input: {
  evidenceIds: string[];
  state: 'verified' | 'conflicting' | 'rejected';
  reviewer: string;
}): Promise<number> {
  const result = await getPool().query({
    text: `UPDATE evidence_items SET verification_state=$1, verified_by=$2, verified_at=now()
           WHERE id = ANY($3::uuid[])`,
    values: [input.state, input.reviewer, input.evidenceIds]
  });
  return result.rowCount ?? 0;
}

export async function listEvidence(productVersionId: string) {
  const result = await getPool().query({
    text: `SELECT ei.id,ei.dimension_key,ei.claim,ei.excerpt,ei.signal,ei.strength,ei.reliability,ei.applicability,
                  ei.limitations,ei.verification_state,ei.verified_by,ei.verified_at,
                  s.url,s.publisher,s.title,s.source_type,s.published_at,ss.retrieved_at
           FROM evidence_items ei
           JOIN source_snapshots ss ON ss.id=ei.source_snapshot_id
           JOIN sources s ON s.id=ss.source_id
           WHERE ei.product_version_id=$1
           ORDER BY s.publisher,ei.dimension_key,ei.created_at`,
    values: [productVersionId]
  });
  return result.rows;
}

export async function listAssessments(status: 'pending' | 'approved' | 'changes_requested' | 'rejected' = 'pending') {
  const result = await getPool().query({
    text: `SELECT a.id,a.fit_score,a.confidence,a.evidence_coverage,a.evidence_state,a.fit_label,a.summary,a.limitations,
                  a.review_status,a.created_at,pv.display_name,c.key AS category_key,rv.version AS rubric_version,
                  ar.evidence_cutoff,ar.quarter
           FROM assessments a
           JOIN product_versions pv ON pv.id=a.product_version_id
           JOIN products p ON p.id=pv.product_id
           JOIN categories c ON c.id=p.category_id
           JOIN rubric_versions rv ON rv.id=a.rubric_version_id
           JOIN assessment_runs ar ON ar.id=a.run_id
           WHERE a.review_status=$1 ORDER BY a.created_at DESC`,
    values: [status]
  });
  return result.rows;
}

export async function reviewAssessment(input: {
  assessmentId: string;
  decision: 'approved' | 'changes_requested' | 'rejected';
  reviewer: string;
  note: string;
}): Promise<void> {
  await withTransaction(async (client) => {
    const updated = await client.query({
      text: 'UPDATE assessments SET review_status=$1 WHERE id=$2 RETURNING id',
      values: [input.decision, input.assessmentId]
    });
    if (!updated.rowCount) throw new Error('Assessment not found');
    await client.query({
      text: `INSERT INTO review_events (assessment_id,decision,reviewer,note) VALUES ($1,$2,$3,$4)`,
      values: [input.assessmentId, input.decision, input.reviewer, input.note]
    });
    if (input.decision === 'approved') {
      await client.query({
        text: `UPDATE products p SET status='active',updated_at=now()
               FROM product_versions pv,assessments a
               WHERE a.id=$1 AND pv.id=a.product_version_id AND p.id=pv.product_id`,
        values: [input.assessmentId]
      });
    }
  });
}

export async function publishReport(input: {
  title: string;
  quarter: string;
  evidenceCutoff: string;
  rubricVersion: string;
  assessmentIds: string[];
  approvedBy: string;
}): Promise<{ id: string; slug: string; payload: unknown }> {
  return withTransaction(async (client) => {
    const result = await client.query({
      text: `SELECT a.id, a.fit_score, a.confidence, a.evidence_coverage, a.evidence_state, a.fit_label,
                    a.summary, a.limitations, pv.display_name, pv.model_version, p.brand, c.key AS category_key,
                    rv.version AS rubric_version, ar.evidence_cutoff AS assessment_evidence_cutoff, ar.quarter AS assessment_quarter,
                    (SELECT COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
                      'url',src.url,'title',src.title,'publisher',src.publisher,'publishedAt',src.published_at
                    )), '[]'::jsonb)
                     FROM assessment_evidence ae
                     JOIN evidence_items evi ON evi.id=ae.evidence_item_id
                     JOIN source_snapshots snap ON snap.id=evi.source_snapshot_id
                     JOIN sources src ON src.id=snap.source_id
                     WHERE ae.assessment_id=a.id) AS sources,
                    COALESCE(jsonb_agg(jsonb_build_object(
                      'key', ad.dimension_key, 'label', ad.label, 'score', ad.score,
                      'confidence', ad.confidence, 'evidenceCount', ad.evidence_count,
                      'sourceCount', ad.source_count
                    ) ORDER BY ad.dimension_key) FILTER (WHERE ad.id IS NOT NULL), '[]'::jsonb) AS dimensions
             FROM assessments a
             JOIN product_versions pv ON pv.id=a.product_version_id
             JOIN products p ON p.id=pv.product_id
             JOIN categories c ON c.id=p.category_id
             JOIN rubric_versions rv ON rv.id=a.rubric_version_id
             JOIN assessment_runs ar ON ar.id=a.run_id
             LEFT JOIN assessment_dimensions ad ON ad.assessment_id=a.id
             WHERE a.id = ANY($1::uuid[]) AND a.review_status='approved'
               AND a.evidence_state IN ('verified','supported') AND a.fit_score IS NOT NULL
               AND ar.evidence_cutoff <= $2::date AND (ar.quarter IS NULL OR ar.quarter=$3)
             GROUP BY a.id,pv.id,p.id,c.id,rv.id,ar.id
             ORDER BY c.key,a.fit_score DESC NULLS LAST,pv.display_name`,
      values: [input.assessmentIds,input.evidenceCutoff,input.quarter]
    });
    if (result.rows.length !== input.assessmentIds.length) {
      throw new Error('Every report assessment must exist and be approved');
    }
    if (result.rows.some((row) => row.rubric_version !== input.rubricVersion)) {
      throw new Error('Report assessments do not match the requested rubric version');
    }
    const payload = {
      reportType: 'TrailGenic Gear Intelligence',
      title: input.title,
      quarter: input.quarter,
      evidenceCutoff: input.evidenceCutoff,
      generatedAt: new Date().toISOString(),
      rubricVersion: input.rubricVersion,
      methodology: 'Versioned public evidence interpreted through category-specific TrailGenic Method rubrics; fit and evidence confidence are reported separately.',
      approvedBy: input.approvedBy,
      products: result.rows.map((row) => ({
        assessmentId: row.id,
        name: row.display_name,
        brand: row.brand,
        modelVersion: row.model_version,
        categoryKey: row.category_key,
        fitScore: row.fit_score === null ? null : Number(row.fit_score),
        confidence: Number(row.confidence),
        evidenceCoverage: Number(row.evidence_coverage),
        evidenceState: row.evidence_state,
        fitLabel: row.fit_label,
        summary: row.summary,
        limitations: row.limitations,
        dimensions: row.dimensions,
        sources: row.sources
      }))
    };
    await client.query('UPDATE report_snapshots SET superseded_at=now() WHERE superseded_at IS NULL');
    const slug = `gear-intelligence-${input.quarter.toLowerCase()}-${Date.now()}`;
    const inserted = await client.query({
      text: `INSERT INTO report_snapshots
               (slug,title,quarter,evidence_cutoff,rubric_version,approved_by,payload)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      values: [slug, input.title, input.quarter, input.evidenceCutoff, input.rubricVersion, input.approvedBy, JSON.stringify(payload)]
    });
    return { id: inserted.rows[0]?.id as string, slug, payload };
  });
}

export async function getLatestReport(): Promise<unknown | null> {
  const result = await getPool().query(`
    SELECT payload FROM report_snapshots
    WHERE superseded_at IS NULL
    ORDER BY published_at DESC LIMIT 1
  `);
  return result.rows[0]?.payload ?? null;
}
