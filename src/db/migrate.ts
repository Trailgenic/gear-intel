import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getPool } from './client.js';

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

export async function runMigrations(directory = resolve(process.cwd(), 'migrations')): Promise<MigrationResult> {
  const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
  const pool = getPool();
  const result: MigrationResult = { applied: [], skipped: [] };

  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
  )`);

  for (const file of files) {
    const exists = await pool.query('SELECT 1 FROM schema_migrations WHERE version=$1', [file]);
    if (exists.rowCount) {
      result.skipped.push(file);
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(await readFile(resolve(directory, file), 'utf8'));
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
      await client.query('COMMIT');
      result.applied.push(file);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return result;
}
