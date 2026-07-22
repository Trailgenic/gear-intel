import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPool } from '../../src/db/client.js';
import { handleError, json, requireCron, requireMethod } from '../../src/http.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, ['GET', 'POST']) || !requireCron(req, res)) return;
  try {
    const result = await getPool().query(`
      UPDATE products p SET status='stale', updated_at=now()
      WHERE p.status='active' AND NOT EXISTS (
        SELECT 1 FROM product_versions pv
        JOIN evidence_items ei ON ei.product_version_id=pv.id AND ei.verification_state='verified'
        WHERE pv.product_id=p.id AND ei.verified_at > now() - interval '180 days'
      ) RETURNING p.id
    `);
    json(res, 200, { staleProducts: result.rowCount ?? 0, checkedAt: new Date().toISOString() });
  } catch (error) {
    handleError(res, error);
  }
}
