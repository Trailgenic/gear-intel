import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getReportForExport } from '../../src/publishing/report.js';
import { handleError, json, requireMethod } from '../../src/http.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, ['GET'])) return;
  try {
    const report = await getReportForExport();
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    json(res, 200, report);
  } catch (error) {
    handleError(res, error);
  }
}
