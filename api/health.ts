import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPool } from '../src/db/client.js';
import { handleError, json, requireMethod } from '../src/http.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, ['GET'])) return;
  try {
    await getPool().query('SELECT 1');
    json(res, 200, { status: 'ok', version: '2.0.0', database: 'connected' });
  } catch (error) {
    handleError(res, error);
  }
}
