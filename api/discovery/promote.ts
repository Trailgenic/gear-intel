import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PromoteCandidateSchema } from '../../src/domain/schemas.js';
import { handleError, json, requireAdmin, requireMethod } from '../../src/http.js';
import { promoteCandidate } from '../../src/services/discovery.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, ['POST']) || !requireAdmin(req, res)) return;
  try {
    const { candidateId, reviewer } = PromoteCandidateSchema.parse(req.body);
    json(res, 201, { productVersionId: await promoteCandidate(candidateId, reviewer) });
  } catch (error) {
    handleError(res, error);
  }
}
