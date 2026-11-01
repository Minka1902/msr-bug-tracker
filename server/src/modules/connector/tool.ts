import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ZodError } from 'zod';
import { query } from '../../db/pool';
import { HttpError } from '../../lib/httpError';
import type { UserRow } from '../users/service';
import { failure, result } from './format';

export interface ToolContext {
  user: UserRow;
  timezone: string;
  canWrite: boolean;
}

interface InstructionRow {
  key: string;
  ai_start: string;
  ai_finish: string;
}

export const READ = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
export const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

const PROJECT_INSTRUCTIONS = `
  SELECT key::text, ai_start, ai_finish FROM projects
  WHERE key = ANY($1::citext[]) AND (ai_start <> '' OR ai_finish <> '')
  ORDER BY key`;

const blocks = (rows: InstructionRow[], field: 'ai_start' | 'ai_finish', when: string) =>
  rows
    .filter((row) => row[field])
    .map((row) => ({ type: 'text' as const, text: `${row.key} instructions, ${when}:\n${row[field]}` }));

const withInstructions = async (answer: CallToolResult, projectKeys: Set<string>) => {
  if (!projectKeys.size) return answer;
  const rows = await query<InstructionRow>(PROJECT_INSTRUCTIONS, [[...projectKeys]]);
  if (!rows.length) return answer;
  return {
    ...answer,
    content: [
      ...blocks(rows, 'ai_start', 'before you start'),
      ...answer.content,
      ...blocks(rows, 'ai_finish', 'when you finish'),
    ],
  };
};

export const run =
  <Args>(handler: (args: Args, projectKeys: Set<string>) => Promise<unknown>) =>
  async (args: Args): Promise<CallToolResult> => {
    const projectKeys = new Set<string>();
    try {
      return await withInstructions(result(await handler(args, projectKeys)), projectKeys);
    } catch (error) {
      if (error instanceof HttpError) {
        const missing = (error.details as { missing?: string[] } | undefined)?.missing;
        return failure(
          missing ? `${error.message} (missing permission: ${missing.join(', ')})` : error.message,
        );
      }
      if (error instanceof ZodError)
        return failure(
          error.issues.map(({ path, message }) => `${path.join('.') || 'input'}: ${message}`).join('; '),
        );
      throw error;
    }
  };
