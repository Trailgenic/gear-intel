import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleError, json, requireMethod } from '../../src/http.js';
import { discoverProducts } from '../../src/services/discovery.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, ['GET', 'POST'])) return;
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.authorization !== `Bearer ${expected}`) return json(res, 401, { error: 'Unauthorized' });
  try {
    json(res, 200, await discoverProducts());
  } catch (error) {
    handleError(res, error);
  }
}
