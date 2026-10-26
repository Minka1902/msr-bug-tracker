import { z } from 'zod';
import { positionSchema } from './project';

const listName = z.string().trim().min(1, 'Name the list').max(60);
const itemName = z.string().trim().min(1, 'Add an item').max(120);
const quantity = z.string().trim().max(40);

export const createListSchema = z.object({ name: listName });
export const updateListSchema = z.object({ name: listName, position: positionSchema }).partial().strict();

export const createItemSchema = z.object({ name: itemName, quantity: quantity.default('') });
export const updateItemSchema = z
  .object({ name: itemName, quantity, isChecked: z.boolean(), position: positionSchema })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
