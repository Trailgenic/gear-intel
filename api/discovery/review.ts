import type { VercelRequest, VercelResponse } from '@vercel/node';
import { CandidateReviewBatchSchema } from '../../src/domain/schemas.js';
import { handleError, json, requireAdmin, requireMethod } from '../../src/http.js';
import { reviewCandidates } from '../../src/services/discovery.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, ['POST']) || !requireAdmin(req, res)) return;
  try {
    const { reviews } = CandidateReviewBatchSchema.parse(req.body);
    json(res, 200, { reviews: await reviewCandidates(reviews) });
  } catch (error) {
    handleError(res, error);
  }
}
