import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { listAssessments } from '../../src/db/queries.js';
import { handleError, json, requireAdmin, requireMethod } from '../../src/http.js';

const Status = z.enum(['pending','approved','changes_requested','rejected']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, ['GET']) || !requireAdmin(req, res)) return;
  try {
    const status = Status.parse(typeof req.query.status === 'string' ? req.query.status : 'pending');
    json(res, 200, { assessments: await listAssessments(status) });
  } catch (error) {
    handleError(res, error);
  }
}
