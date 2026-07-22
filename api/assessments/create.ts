import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { handleError, json, requireAdmin, requireMethod } from '../../src/http.js';
import { assessProduct } from '../../src/services/assessment.js';

const Body = z.object({
  productVersionId: z.string().uuid(),
  evidenceCutoff: z.string().date(),
  quarter: z.string().regex(/^\d{4}-Q[1-4]$/).optional(),
  runType: z.enum(['manual','weekly_refresh','quarterly','reassessment']).default('manual')
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, ['POST']) || !requireAdmin(req, res)) return;
  try {
    const body = Body.parse(req.body);
    json(res, 201, await assessProduct({
      productVersionId: body.productVersionId,
      evidenceCutoff: body.evidenceCutoff,
      runType: body.runType,
      ...(body.quarter ? { quarter: body.quarter } : {})
    }));
  } catch (error) {
    handleError(res, error);
  }
}
