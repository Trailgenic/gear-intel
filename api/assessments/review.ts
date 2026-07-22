import type { VercelRequest, VercelResponse } from '@vercel/node';
import { reviewAssessment } from '../../src/db/queries.js';
import { ReviewDecisionSchema } from '../../src/domain/schemas.js';
import { handleError, json, requireAdmin, requireMethod } from '../../src/http.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, ['POST']) || !requireAdmin(req, res)) return;
  try {
    const body = ReviewDecisionSchema.parse(req.body);
    await reviewAssessment(body);
    json(res, 200, { success: true });
  } catch (error) {
    handleError(res, error);
  }
}
