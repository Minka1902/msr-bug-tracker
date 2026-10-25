import { query, queryOne, transaction, type Db } from '../../db/pool';
import { removeStored } from '../../lib/storage';
import { generateDemoData, type DemoSize } from './generator';

const DEMO_PROJECTS = `p.is_demo AND (p.owner_id = $1 OR p.owner_id IN (SELECT id FROM users WHERE demo_owner_id = $1))`;

const DEMO_FILE_KEYS = `
  SELECT a.storage_key FROM attachments a JOIN tasks t ON t.id = a.task_id JOIN projects p ON p.id = t.project_id
  WHERE ${DEMO_PROJECTS}`;
const DELETE_DEMO_PROJECTS = `DELETE FROM projects p WHERE ${DEMO_PROJECTS}`;
const DELETE_DEMO_USERS = 'DELETE FROM users WHERE demo_owner_id = $1';
const DELETE_DEMO_SET = 'DELETE FROM demo_sets WHERE owner_id = $1';
const UPSERT_DEMO_SET = `
  INSERT INTO demo_sets (owner_id, seed, size) VALUES ($1, $2, $3)
  ON CONFLICT (owner_id) DO UPDATE SET seed = EXCLUDED.seed, size = EXCLUDED.size, created_at = now()`;
const DEMO_STATUS = `
  SELECT d.seed, d.size, d.created_at,
         (SELECT count(*)::int FROM projects p WHERE ${DEMO_PROJECTS}) AS projects,
         (SELECT count(*)::int FROM tasks t JOIN projects p ON p.id = t.project_id WHERE ${DEMO_PROJECTS}) AS tasks
  FROM demo_sets d WHERE d.owner_id = $1`;
const TEAMMATES = `
  SELECT u.id, u.name, u.email,
         (SELECT r.name FROM project_members m JOIN project_roles r ON r.id = m.role_id JOIN projects p ON p.id = m.project_id
          WHERE m.user_id = u.id AND p.owner_id = $1 AND p.is_demo ORDER BY p.created_at LIMIT 1) AS role_name
  FROM users u WHERE u.demo_owner_id = $1 ORDER BY u.created_at, u.name`;
const DEMO_USER = 'SELECT id FROM users WHERE id = $1 AND demo_owner_id = $2';

const removeWithin = async (db: Db, ownerId: string) => {
  const files = await query<{ storage_key: string }>(DEMO_FILE_KEYS, [ownerId], db);
  await query(DELETE_DEMO_PROJECTS, [ownerId], db);
  await query(DELETE_DEMO_USERS, [ownerId], db);
  await query(DELETE_DEMO_SET, [ownerId], db);
  return files.map((file) => file.storage_key);
};

export const getDemoStatus = async (ownerId: string) => {
  const [set, teammates] = await Promise.all([
    queryOne<{ seed: number; size: DemoSize; created_at: Date; projects: number; tasks: number }>(
      DEMO_STATUS,
      [ownerId],
    ),
    query<{ id: string; name: string; email: string; role_name: string | null }>(TEAMMATES, [ownerId]),
  ]);
  return {
    exists: !!set,
    seed: set?.seed ?? null,
    size: set?.size ?? null,
    generatedAt: set?.created_at.toISOString() ?? null,
    counts: { projects: set?.projects ?? 0, tasks: set?.tasks ?? 0 },
    teammates: teammates.map((mate) => ({
      id: mate.id,
      name: mate.name,
      email: mate.email,
      roleName: mate.role_name ?? 'Member',
    })),
  };
};

export const generateDemo = async (ownerId: string, size: DemoSize, seed: number) => {
  let created: string[] = [];
  try {
    const removed = await transaction(async (db) => {
      const previous = await removeWithin(db, ownerId);
      const result = await generateDemoData(db, ownerId, size, seed);
      created = result.copiedKeys;
      await query(UPSERT_DEMO_SET, [ownerId, seed, size], db);
      return previous;
    });
    await removeStored(removed);
  } catch (error) {
    await removeStored(created);
    throw error;
  }
};

export const removeDemo = async (ownerId: string) =>
  removeStored(await transaction((db) => removeWithin(db, ownerId)));

export const isOwnDemoUser = async (userId: string, ownerId: string) =>
  !!(await queryOne(DEMO_USER, [userId, ownerId]).catch(() => undefined));
