import pg from 'pg';
import { config } from '../config';

pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 20 });

export type Db = pg.Pool | pg.PoolClient;

export const query = <T extends pg.QueryResultRow>(text: string, values?: unknown[], db: Db = pool) =>
  db.query<T>(text, values).then((result) => result.rows);

export const queryOne = <T extends pg.QueryResultRow>(text: string, values?: unknown[], db: Db = pool) =>
  db.query<T>(text, values).then((result) => result.rows[0] as T | undefined);

export const prepared = <T extends pg.QueryResultRow>(name: string, text: string, values: unknown[], db: Db = pool) =>
  db.query<T>({ name, text, values }).then((result) => result.rows);

export const transaction = async <T>(work: (client: pg.PoolClient) => Promise<T>) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
