import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleError, json, requireCron, requireMethod } from '../../src/http.js';
import { runEditorialPipeline } from '../../src/services/pipeline.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, ['GET','POST']) || !requireCron(req, res)) return;
  try {
    json(res, 200, await runEditorialPipeline('scheduled'));
  } catch (error) {
    handleError(res, error);
  }
}
