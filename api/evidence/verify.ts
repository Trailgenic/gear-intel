import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { verifyEvidence } from '../../src/db/queries.js';
import { handleError, json, requireAdmin, requireMethod } from '../../src/http.js';

const Body = z.object({
  evidenceIds: z.array(z.string().uuid()).min(1).max(100),
  state: z.enum(['verified', 'conflicting', 'rejected']),
  reviewer: z.string().trim().min(1).max(160)
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, ['POST']) || !requireAdmin(req, res)) return;
  try {
    const body = Body.parse(req.body);
    json(res, 200, { updated: await verifyEvidence(body) });
  } catch (error) {
    handleError(res, error);
  }
}
