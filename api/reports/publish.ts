import type { VercelRequest, VercelResponse } from '@vercel/node';
import { publishReport } from '../../src/db/queries.js';
import { PublishReportSchema } from '../../src/domain/schemas.js';
import { handleError, json, requireAdmin, requireMethod } from '../../src/http.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, ['POST']) || !requireAdmin(req, res)) return;
  try {
    json(res, 201, await publishReport(PublishReportSchema.parse(req.body)));
  } catch (error) {
    handleError(res, error);
  }
}
