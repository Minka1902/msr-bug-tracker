import { migrate } from './migrate';
import { pool } from './pool';

const applied = await migrate();
console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is up to date');
await pool.end();
