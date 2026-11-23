import { MODULE_META } from '@msr/shared/modules';
import { query, transaction, type Db } from '../../db/pool';
import { badRequest } from '../../lib/httpError';
import type { ProjectContext } from './access';

const LOCK_MAIN = 'SELECT pg_advisory_xact_lock(hashtextextended($1::text, 727002))';
const CLAIM_MAIN = `
  UPDATE project_members m SET is_main = true
  FROM projects p
  WHERE m.project_id = $1 AND m.user_id = $2 AND p.id = m.project_id AND p.kind = 'household'
    AND NOT EXISTS (SELECT 1 FROM project_members o WHERE o.user_id = $2 AND o.is_main)`;
const CLEAR_MAIN = 'UPDATE project_members SET is_main = false WHERE user_id = $1 AND is_main';
const SET_MAIN = 'UPDATE project_members SET is_main = true WHERE project_id = $1 AND user_id = $2';

export const claimMainHousehold = async (db: Db, projectId: string, userId: string) => {
  await query(LOCK_MAIN, [userId], db);
  await query(CLAIM_MAIN, [projectId, userId], db);
};

export const setMainHousehold = (project: ProjectContext, userId: string) => {
  if (MODULE_META[project.module].kind !== 'household')
    throw badRequest('Only a household can be your main project');
  return transaction(async (db) => {
    await query(LOCK_MAIN, [userId], db);
    await query(CLEAR_MAIN, [userId], db);
    await query(SET_MAIN, [project.id, userId], db);
  });
};
