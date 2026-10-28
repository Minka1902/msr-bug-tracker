import { z } from 'zod';
import { nameSchema } from './auth';
import { uuidSchema } from './project';

export const createAgentSchema = z.object({ grantId: uuidSchema, name: nameSchema });
export const updateAgentSchema = z
  .object({ grantId: uuidSchema, name: nameSchema })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');
export const addAgentMemberSchema = z.object({ agentId: uuidSchema, roleId: uuidSchema });
