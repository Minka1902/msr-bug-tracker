import { pool, transaction } from '../../db/pool';
import { migrate } from '../../db/migrate';
import { hashPassword } from '../../lib/passwords';
import { findUserByEmail, insertUser } from '../users/service';
import { generateDemo } from './service';

const EMAIL = 'demo@msr.local';
const PASSWORD = 'demo-password';

await migrate();
const existing = await findUserByEmail(EMAIL);
const user =
  existing ??
  (await transaction(async (db) => {
    const created = await insertUser('Demo User', EMAIL, await hashPassword(PASSWORD), {}, db);
    await db.query('UPDATE users SET email_verified_at = now() WHERE id = $1', [created.id]);
    return created;
  }));
await generateDemo(user.id, 'small', 42);
console.log(`Demo data ready. Sign in as ${EMAIL} / ${PASSWORD}`);
await pool.end();
