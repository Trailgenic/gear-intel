import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { listEvidence } from '../../src/db/queries.js';
import { handleError, json, requireAdmin, requireMethod } from '../../src/http.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, ['GET']) || !requireAdmin(req, res)) return;
  try {
    const productVersionId = z.string().uuid().parse(req.query.productVersionId);
    json(res, 200, { evidence: await listEvidence(productVersionId) });
  } catch (error) {
    handleError(res, error);
  }
}
