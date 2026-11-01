import { z } from 'zod';
import { TASK_TYPES } from '../enums';
import { colorSchema, iconSchema, uuidSchema } from './project';

const roleIds = z
  .array(uuidSchema)
  .max(50)
  .transform((ids) => [...new Set(ids)]);

const cardTypeFields = {
  name: z.string().trim().min(1, 'Name is required').max(40),
  icon: iconSchema,
  color: colorSchema,
  createRoleIds: roleIds,
  editRoleIds: roleIds,
};

export const cardTypeSchema = z.object({
  ...cardTypeFields,
  base: z.enum(TASK_TYPES),
  createRoleIds: roleIds.default([]),
  editRoleIds: roleIds.default([]),
});
export const updateCardTypeSchema = z
  .object(cardTypeFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export type CardTypeInput = z.infer<typeof cardTypeSchema>;
export type UpdateCardTypeInput = z.infer<typeof updateCardTypeSchema>;
