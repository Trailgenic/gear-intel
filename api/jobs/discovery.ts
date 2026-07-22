import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleError, json, requireCron, requireMethod } from '../../src/http.js';
import { discoverProducts } from '../../src/services/discovery.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, ['GET', 'POST']) || !requireCron(req, res)) return;
  try {
    json(res, 200, await discoverProducts());
  } catch (error) {
    handleError(res, error);
  }
}
