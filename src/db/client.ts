import pg from 'pg';

const { Pool } = pg;
let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  // Vercel Postgres integrations commonly inject POSTGRES_URL. DATABASE_URL
  // remains the explicit, portable override for any other Postgres provider.
  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!connectionString) throw new Error('DATABASE_URL or POSTGRES_URL is required');
  pool ??= new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
  });
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) await pool.end();
  pool = undefined;
}

export async function withTransaction<T>(callback: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
