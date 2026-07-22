import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SourceImportSchema } from '../../src/domain/schemas.js';
import { handleError, json, requireAdmin, requireMethod } from '../../src/http.js';
import { importEvidence } from '../../src/services/evidence.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, ['POST']) || !requireAdmin(req, res)) return;
  try {
    const result = await importEvidence(SourceImportSchema.parse(req.body));
    json(res, 201, result);
  } catch (error) {
    handleError(res, error);
  }
}
