export default async () => {
  process.env.NODE_ENV = 'test';
  const { migrate } = await import('../src/db/migrate');
  const { pool } = await import('../src/db/pool');
  await migrate();
  await pool.end();
};
