import { getPool } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { seedDatabase } from '../db/seed.js';
import { autoPromotePendingCandidates, discoverProducts, discoveryIsDue } from './discovery.js';
import { getEvidenceQueue, processEvidenceQueue } from './evidence-queue.js';
import { generateEditorialReport } from './editorial.js';

type TriggerType = 'scheduled' | 'manual';

export async function runEditorialPipeline(triggerType: TriggerType = 'scheduled') {
  const migrations = await runMigrations();
  const seeded = await seedDatabase();
  const created = await getPool().query({
    text: `INSERT INTO pipeline_runs (trigger_type,status,stage,metrics)
           VALUES ($1,'running','discovery',$2) RETURNING id`,
    values: [triggerType,JSON.stringify({ migrations,seeded })]
  });
  const pipelineRunId = created.rows[0]?.id as string;
  const exceptions: unknown[] = [];
  const metrics: Record<string, unknown> = { migrations,seeded,imports: { completed: 0,failed: 0 } };
  const started = Date.now();
  const deadline = started + 235_000;
  try {
    if (await discoveryIsDue()) {
      try {
        metrics.discovery = await discoverProducts();
      } catch (error) {
        exceptions.push({ stage: 'discovery',error: error instanceof Error ? error.message : 'unknown' });
      }
    } else metrics.discovery = { skipped: 'A successful discovery run exists within seven days' };

    try {
      metrics.candidatePromotion = await autoPromotePendingCandidates();
    } catch (error) {
      exceptions.push({ stage: 'candidate-promotion',error: error instanceof Error ? error.message : 'unknown' });
    }

    await getPool().query(`UPDATE pipeline_runs SET stage='evidence',metrics=$1,exceptions=$2,updated_at=now() WHERE id=$3`, [
      JSON.stringify(metrics),JSON.stringify(exceptions),pipelineRunId
    ]);

    while (Date.now() < deadline) {
      const batch = await processEvidenceQueue(5);
      if (!batch.claimed) break;
      const imports = metrics.imports as { completed: number; failed: number };
      imports.completed += batch.results.filter((result) => result.status === 'complete').length;
      imports.failed += batch.results.filter((result) => result.status === 'failed').length;
    }

    const queue = await getEvidenceQueue();
    const openJobs = queue.jobs.filter((job) =>
      job.status === 'queued' || job.status === 'running' || (job.status === 'failed' && Number(job.attempts) < 3)
    );
    const terminalFailures = queue.jobs.filter((job) => job.status === 'failed' && Number(job.attempts) >= 3)
      .map((job) => ({ stage: 'evidence',product: job.display_name,url: job.url,error: job.last_error }));
    exceptions.push(...terminalFailures);
    metrics.queue = queue.summary;

    let report: unknown = null;
    if (!openJobs.length && Date.now() < deadline) {
      await getPool().query(`UPDATE pipeline_runs SET stage='editorial',metrics=$1,exceptions=$2,updated_at=now() WHERE id=$3`, [
        JSON.stringify(metrics),JSON.stringify(exceptions),pipelineRunId
      ]);
      report = await generateEditorialReport(pipelineRunId);
      metrics.report = report && typeof report === 'object' && 'published' in report
        ? { published: report.published }
        : { published: false };
    }

    const status = openJobs.length ? 'partial' : 'complete';
    await getPool().query({
      text: `UPDATE pipeline_runs SET status=$1,stage=$2,metrics=$3,exceptions=$4,completed_at=now(),updated_at=now()
             WHERE id=$5`,
      values: [status,status === 'complete' ? 'complete' : 'evidence',JSON.stringify(metrics),JSON.stringify(exceptions),pipelineRunId]
    });
    return { pipelineRunId,status,metrics,exceptions,report };
  } catch (error) {
    exceptions.push({ stage: 'pipeline',error: error instanceof Error ? error.message : 'unknown' });
    await getPool().query({
      text: `UPDATE pipeline_runs SET status='failed',stage='failed',metrics=$1,exceptions=$2,completed_at=now(),updated_at=now()
             WHERE id=$3`,
      values: [JSON.stringify(metrics),JSON.stringify(exceptions),pipelineRunId]
    });
    throw error;
  }
}

export async function getLatestPipelineStatus() {
  const table = await getPool().query(`SELECT to_regclass('public.pipeline_runs') AS relation`);
  if (!table.rows[0]?.relation) return null;
  const result = await getPool().query(`SELECT id,status,stage,metrics,exceptions,started_at,completed_at FROM pipeline_runs ORDER BY started_at DESC LIMIT 1`);
  return result.rows[0] ?? null;
}
