import { z } from 'zod';
import { BOT_PLATFORMS, NOTIFY_KINDS } from '../bots';

export const botPlatformSchema = z.enum(BOT_PLATFORMS);

export const botLinkSchema = z.object({ platform: botPlatformSchema, target: z.enum(['private', 'group']) });

export const updateBotChatSchema = z
  .object({
    notify: z.array(z.enum(NOTIFY_KINDS)).max(NOTIFY_KINDS.length),
    onlyMine: z.boolean(),
    defaultListId: z.uuid().nullable(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export type UpdateBotChatInput = z.infer<typeof updateBotChatSchema>;
