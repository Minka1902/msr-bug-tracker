import { z } from 'zod';
import { RELATION_TYPES } from '../enums';
import { IDENTIFIER_REGEX } from '../identifiers';
import { positionSchema, uuidSchema } from './project';

const body = z.string().trim().min(1, 'Write something first').max(20000);

const attachmentIds = z.array(uuidSchema).max(20).optional();

export const createCommentSchema = z.object({
  body,
  parentId: uuidSchema.nullable().optional(),
  attachmentIds,
});
export const updateCommentSchema = z.object({ body, attachmentIds });

const itemText = z.string().trim().min(1).max(500);
export const createChecklistItemSchema = z.object({ text: itemText });
export const updateChecklistItemSchema = z
  .object({ text: itemText, isDone: z.boolean(), position: positionSchema })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export const createRelationSchema = z.object({
  target: z.string().trim().regex(IDENTIFIER_REGEX, 'Use an ID like WEB-12'),
  type: z.enum(RELATION_TYPES),
});
