import { z } from 'zod';
import { trimUrl } from '../sharedLink';
import { positionSchema } from './project';

const listName = z.string().trim().min(1, 'Name the list').max(60);
const itemName = z.string().trim().min(1, 'Add an item').max(120);
const quantity = z.string().trim().max(40);
const itemUrl = z
  .url({ protocol: /^https?$/, error: 'Use a web link (https://…)' })
  .transform(trimUrl)
  .nullable();

export const createListSchema = z.object({ name: listName });
export const updateListSchema = z.object({ name: listName, position: positionSchema }).partial().strict();

export const createItemSchema = z.object({
  name: itemName,
  quantity: quantity.default(''),
  url: itemUrl.default(null),
});
export const updateItemSchema = z
  .object({ name: itemName, quantity, url: itemUrl, isChecked: z.boolean(), position: positionSchema })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
