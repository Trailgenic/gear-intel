import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleError, requireMethod } from '../../src/http.js';
import { displayQuarter, getReportForExport, reportToMcpDataset } from '../../src/publishing/report.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, ['GET'])) return;
  try {
    const report = await getReportForExport();
    const filename = `trailgenic-gear-intelligence-mcp-${displayQuarter(report.quarter).toLowerCase().replace(/\s+/g,'-')}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    if (req.query.download === '1') res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(`${JSON.stringify(reportToMcpDataset(report), null, 2)}\n`);
  } catch (error) {
    handleError(res, error);
  }
}
