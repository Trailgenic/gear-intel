import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { handleError, json, requireCron, requireMethod } from '../../src/http.js';
import { processEvidenceQueue } from '../../src/services/evidence-queue.js';

const LimitSchema = z.coerce.number().int().min(1).max(3).default(2);
const JobIdSchema = z.string().uuid().optional();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, ['GET','POST']) || !requireCron(req, res)) return;
  try {
    const limit = LimitSchema.parse(typeof req.query.limit === 'string' ? req.query.limit : undefined);
    const jobId = JobIdSchema.parse(typeof req.query.jobId === 'string' ? req.query.jobId : undefined);
    json(res, 200, await processEvidenceQueue(limit, jobId));
  } catch (error) {
    handleError(res, error);
  }
}
