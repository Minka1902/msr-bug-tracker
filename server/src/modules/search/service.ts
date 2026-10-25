import { parseIdentifier } from '@msr/shared/identifiers';
import type { ProjectSummary, TaskCard } from '@msr/shared/types';
import { query } from '../../db/pool';
import { cardSelect, toCard, type CardRow } from '../tasks/queries';

const TASK_LIMIT = 20;
const PROJECT_LIMIT = 6;

const SEARCH_PROJECTS = `
  SELECT p.key::text AS key, p.name, p.color, p.icon
  FROM project_members m JOIN projects p ON p.id = m.project_id
  WHERE m.user_id = $1 AND (p.name ILIKE $2 OR p.key ILIKE $3 OR $4 <% p.name)
  ORDER BY p.archived_at IS NOT NULL, word_similarity($4, p.name) DESC, p.name
  LIMIT ${PROJECT_LIMIT}`;

const SEARCH_TASKS = `${cardSelect()}
  WHERE t.project_id IN (SELECT project_id FROM project_members WHERE user_id = $1)
    AND ((p.key = $2 AND t.number = $3) OR ($4::text IS NOT NULL AND t.search_vector @@ to_tsquery('simple', $4)) OR t.title ILIKE $5 OR $6 <% t.title)
  ORDER BY (p.key = $2 AND t.number = $3) DESC NULLS LAST,
           ts_rank(t.search_vector, to_tsquery('simple', COALESCE($4, ''))) DESC,
           word_similarity($6, t.title) DESC, t.updated_at DESC
  LIMIT ${TASK_LIMIT}`;

const toTsQuery = (text: string) => {
  const tokens = text.match(/[\p{L}\p{N}_]+/gu) ?? [];
  return tokens.length
    ? tokens
        .map((token, index) => `${token.toLowerCase()}${index === tokens.length - 1 ? ':*' : ''}`)
        .join(' & ')
    : null;
};

const like = (text: string) => `%${text.replace(/[\\%_]/g, '\\$&')}%`;

export const search = async (
  userId: string,
  text: string,
): Promise<{ projects: Pick<ProjectSummary, 'key' | 'name' | 'color' | 'icon'>[]; tasks: TaskCard[] }> => {
  const q = text.trim();
  if (!q) return { projects: [], tasks: [] };
  const identifier = parseIdentifier(q);
  const [projects, tasks] = await Promise.all([
    query<{ key: string; name: string; color: string; icon: string }>(SEARCH_PROJECTS, [
      userId,
      like(q),
      `${q.replace(/[\\%_]/g, '\\$&')}%`,
      q,
    ]),
    query<CardRow>(SEARCH_TASKS, [
      userId,
      identifier?.key ?? null,
      identifier?.number ?? null,
      toTsQuery(q),
      like(q),
      q,
    ]),
  ]);
  return { projects, tasks: tasks.map(toCard) };
};
