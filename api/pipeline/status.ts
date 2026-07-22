import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleError, json, requireMethod } from '../../src/http.js';
import { getLatestPipelineStatus } from '../../src/services/pipeline.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, ['GET'])) return;
  try {
    const status = await getLatestPipelineStatus();
    if (!status) return json(res, 404, { error: 'No pipeline run exists' });
    json(res, 200, status);
  } catch (error) {
    handleError(res, error);
  }
}
