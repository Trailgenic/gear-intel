import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleError, json, requireAdmin, requireMethod } from '../../src/http.js';
import { listCandidates } from '../../src/services/discovery.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, ['GET']) || !requireAdmin(req, res)) return;
  try {
    json(res, 200, { candidates: await listCandidates() });
  } catch (error) {
    handleError(res, error);
  }
}
