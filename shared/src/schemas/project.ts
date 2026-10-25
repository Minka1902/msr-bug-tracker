import { z } from 'zod';
import { STATUS_CATEGORIES, WORKFLOWS } from '../enums';
import { PROJECT_KEY_REGEX } from '../identifiers';
import { ALL_PERMISSIONS } from '../permissions';
import { emailSchema } from './auth';

export const projectKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(PROJECT_KEY_REGEX, 'Use 2–6 letters or digits, starting with a letter');
export const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a color');
export const iconSchema = z.string().regex(/^[a-z0-9-]{1,40}$/, 'Pick an icon');
export const uuidSchema = z.uuid();
export const positionSchema = z.string().min(1).max(64);

const projectFields = {
  name: z.string().trim().min(1, 'Name is required').max(80),
  description: z.string().trim().max(2000),
  color: colorSchema,
  icon: iconSchema,
};

export const createProjectSchema = z.object({
  ...projectFields,
  key: projectKeySchema,
  description: projectFields.description.default(''),
});
export const updateProjectSchema = z.object(projectFields).partial().strict();
export const favoriteSchema = z.object({ favorite: z.boolean() });

const statusName = z.string().trim().min(1, 'Name is required').max(40);

export const createStatusSchema = z.object({
  workflow: z.enum(WORKFLOWS),
  name: statusName,
  color: colorSchema,
  category: z.enum(STATUS_CATEGORIES),
});
export const updateStatusSchema = z
  .object({
    name: statusName,
    color: colorSchema,
    category: z.enum(STATUS_CATEGORIES),
    position: positionSchema,
  })
  .partial()
  .strict();
export const deleteStatusSchema = z.object({ moveTo: uuidSchema });

export const labelSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(40),
  color: colorSchema,
});
export const updateLabelSchema = labelSchema.partial().strict();

export const permissionMaskSchema = z
  .number()
  .int()
  .min(0)
  .refine((mask) => (mask & ~ALL_PERMISSIONS) === 0, 'Unknown permission');

export const createRoleSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(40),
  permissions: permissionMaskSchema,
});
export const updateRoleSchema = createRoleSchema.partial().strict();
export const deleteRoleSchema = z.object({ reassignToRoleId: uuidSchema });

export const addMemberSchema = z.object({ email: emailSchema, roleId: uuidSchema });
export const updateMemberSchema = z.object({ roleId: uuidSchema });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
