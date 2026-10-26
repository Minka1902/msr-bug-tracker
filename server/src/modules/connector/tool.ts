import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ZodError } from 'zod';
import { HttpError } from '../../lib/httpError';
import type { UserRow } from '../users/service';
import { failure, result } from './format';

export interface ToolContext {
  user: UserRow;
  timezone: string;
  canWrite: boolean;
}

export const READ = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
export const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

export const run =
  <Args>(handler: (args: Args) => Promise<unknown>) =>
  async (args: Args): Promise<CallToolResult> => {
    try {
      return result(await handler(args));
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
