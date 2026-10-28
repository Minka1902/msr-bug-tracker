import { z } from 'zod';
import { NOTIFY_KINDS } from '../telegram';

export const telegramLinkSchema = z.object({ target: z.enum(['private', 'group']) });

export const updateTelegramChatSchema = z
  .object({
    notify: z.array(z.enum(NOTIFY_KINDS)).max(NOTIFY_KINDS.length),
    onlyMine: z.boolean(),
    defaultListId: z.uuid().nullable(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export type UpdateTelegramChatInput = z.infer<typeof updateTelegramChatSchema>;
