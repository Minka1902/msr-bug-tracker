import { createRequire } from 'node:module';

const { Client } = createRequire(new URL('../server/package.json', import.meta.url))('pg');
const target = new URL(process.env.DATABASE_URL);
const name = target.pathname.slice(1);
const admin = new URL(target);
admin.pathname = '/postgres';

const client = new Client({ connectionString: admin.href });
await client.connect();
await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
await client.query(`CREATE DATABASE "${name}"`);
await client.end();
