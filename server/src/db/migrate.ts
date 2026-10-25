import fs from 'node:fs/promises';
import path from 'node:path';
import { pool } from './pool';

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, 'migrations');
const LOCK_ID = 727_001;

export const migrate = async () => {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const applied = new Set(
      (await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((row) => row.name),
    );
    const files = (await fs.readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.sql')).sort();
    const pending = files.filter((file) => !applied.has(file));
    for (const file of pending) {
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${(error as Error).message}`, { cause: error });
      }
    }
    return pending;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]);
    client.release();
  }
};
