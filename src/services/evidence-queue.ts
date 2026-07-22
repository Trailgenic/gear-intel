import type pg from 'pg';
import { getPool, withTransaction } from '../db/client.js';
import type { SourceType } from '../domain/schemas.js';
import { importEvidence } from './evidence.js';

interface EvidenceQueueJob {
  id: string;
  product_version_id: string;
  url: string;
  source_type: SourceType;
  published_at: string | null;
  evidence_cutoff: string | null;
}

function normalizedHost(rawUrl: string): string {
  return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, '');
}

export function sourceTypeForUrl(url: string, officialUrl: string): SourceType {
  const sourceHost = normalizedHost(url);
  const officialHost = normalizedHost(officialUrl);
  return sourceHost === officialHost || sourceHost.endsWith(`.${officialHost}`) || officialHost.endsWith(`.${sourceHost}`)
    ? 'manufacturer'
    : 'expert_review';
}

export async function enqueueCandidateSources(
  client: pg.PoolClient,
  productVersionId: string,
  officialUrl: string,
  evidenceUrls: string[]
): Promise<void> {
  for (const url of [...new Set(evidenceUrls)]) {
    await client.query({
      text: `INSERT INTO evidence_import_queue (product_version_id,url,source_type)
             VALUES ($1,$2,$3)
             ON CONFLICT (product_version_id,url) DO UPDATE SET
               source_type=EXCLUDED.source_type,updated_at=now()`,
      values: [productVersionId, url, sourceTypeForUrl(url, officialUrl)]
    });
  }
}

async function claimJobs(limit: number, jobId?: string): Promise<EvidenceQueueJob[]> {
  return withTransaction(async (client) => {
    const result = await client.query({
      text: `WITH next_jobs AS (
               SELECT id FROM evidence_import_queue
               WHERE (status IN ('queued','failed') OR (status='running' AND started_at < now() - interval '10 minutes'))
                 AND attempts < 3
                 AND ($2::uuid IS NULL OR id=$2::uuid)
               ORDER BY CASE status WHEN 'queued' THEN 0 ELSE 1 END, created_at
               LIMIT $1 FOR UPDATE SKIP LOCKED
             )
             UPDATE evidence_import_queue AS queue
             SET status='running',attempts=queue.attempts+1,last_error='',started_at=now(),updated_at=now()
             FROM next_jobs
             WHERE queue.id=next_jobs.id
             RETURNING queue.id,queue.product_version_id,queue.url,queue.source_type,
                       queue.published_at::text,queue.evidence_cutoff::text`,
      values: [limit, jobId ?? null]
    });
    return result.rows as EvidenceQueueJob[];
  });
}

async function finishJob(id: string, result: unknown): Promise<void> {
  await getPool().query({
    text: `UPDATE evidence_import_queue
           SET status='complete',result=$1,last_error='',completed_at=now(),updated_at=now()
           WHERE id=$2`,
    values: [JSON.stringify(result), id]
  });
}

async function failJob(id: string, error: unknown): Promise<string> {
  const message = error instanceof Error ? error.message : 'Unknown import error';
  await getPool().query({
    text: `UPDATE evidence_import_queue
           SET status='failed',last_error=$1,completed_at=now(),updated_at=now()
           WHERE id=$2`,
    values: [message.slice(0, 2000), id]
  });
  return message;
}

export async function processEvidenceQueue(limit: number, jobId?: string) {
  const jobs = await claimJobs(limit, jobId);
  const results = await Promise.all(jobs.map(async (job) => {
    try {
      const imported = await importEvidence({
        productVersionId: job.product_version_id,
        url: job.url,
        sourceType: job.source_type,
        ...(job.published_at ? { publishedAt: job.published_at } : {}),
        ...(job.evidence_cutoff ? { evidenceCutoff: job.evidence_cutoff } : {})
      });
      await finishJob(job.id, imported);
      return { id: job.id, url: job.url, status: 'complete', ...imported };
    } catch (error) {
      return { id: job.id, url: job.url, status: 'failed', error: await failJob(job.id, error) };
    }
  }));
  return { claimed: jobs.length, results };
}

export async function getEvidenceQueue() {
  const [summary, jobs] = await Promise.all([
    getPool().query(`SELECT status,count(*)::integer AS count FROM evidence_import_queue GROUP BY status ORDER BY status`),
    getPool().query(`SELECT queue.id,queue.url,queue.source_type,queue.status,queue.attempts,queue.last_error,
                            queue.result,queue.started_at,queue.completed_at,version.display_name
                     FROM evidence_import_queue AS queue
                     JOIN product_versions AS version ON version.id=queue.product_version_id
                     ORDER BY queue.status,version.display_name,queue.created_at
                     LIMIT 500`)
  ]);
  return { summary: summary.rows, jobs: jobs.rows };
}
