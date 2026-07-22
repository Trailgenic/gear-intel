import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runMigrations } from '../../src/db/migrate.js';
import { seedDatabase } from '../../src/db/seed.js';
import { handleError, json, requireAdmin, requireMethod } from '../../src/http.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, ['POST']) || !requireAdmin(req, res)) return;
  try {
    const migrations = await runMigrations();
    const seeded = await seedDatabase();
    json(res, 200, { status: 'initialized', migrations, seeded });
  } catch (error) {
    handleError(res, error);
  }
}
