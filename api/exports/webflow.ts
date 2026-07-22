import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleError, requireMethod } from '../../src/http.js';
import { renderWebflowEmbed } from '../../src/publishing/webflow.js';
import { displayQuarter, getReportForExport } from '../../src/publishing/report.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, ['GET'])) return;
  try {
    const report = await getReportForExport();
    const filename = `trailgenic-gear-intelligence-${displayQuarter(report.quarter).toLowerCase().replace(/\s+/g,'-')}.html`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    if (req.query.download === '1') res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(renderWebflowEmbed(report));
  } catch (error) {
    handleError(res, error);
  }
}
