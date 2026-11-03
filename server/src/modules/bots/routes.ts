import { Router, type Request } from 'express';
import { BOT_PLATFORM_META, BOT_PLATFORMS, kindsFor } from '@msr/shared/bots';
import { botAllowed, minimumBotPlan, PLAN_META } from '@msr/shared/modules';
import { can } from '@msr/shared/permissions';
import { botLinkSchema, botPlatformSchema, updateBotChatSchema } from '@msr/shared/schemas/bots';
import type { BotChat, BotLink, BotSettings } from '@msr/shared/types';
import { z } from 'zod';
import { HttpError, badRequest, forbidden, notFound, paymentRequired } from '../../lib/httpError';
import { assertCan, assertWritable, projectOf, type ProjectContext } from '../projects/access';
import { currentPlan } from '../shop/service';
import { listExists } from '../shopping/service';
import { PLATFORMS } from './platforms';
import {
  createLinkCode,
  deleteChat,
  linkedPlatforms,
  projectChats,
  unlinkUser,
  updateChat,
  type ChatRef,
  type ChatRow,
} from './service';

const chatIdSchema = z.string().regex(/^-?\d{1,20}$/);

const enabledPlatforms = () => BOT_PLATFORMS.filter((platform) => PLATFORMS[platform].enabled());

const botAccess = async (project: ProjectContext) => {
  const { tier } = await currentPlan(project.ownerId);
  return { allowed: botAllowed(tier, project.module), requiredPlan: minimumBotPlan(project.module) };
};

const canEditChat = (project: ProjectContext, chat: ChatRow, userId: string) =>
  chat.is_group ? can(project.permissions, 'project.edit') : chat.linked_by === userId;

const toChat = (chat: ChatRow, userId: string): BotChat => ({
  platform: chat.platform,
  chatId: chat.chat_id,
  title: chat.title,
  isGroup: chat.is_group,
  notify: chat.notify,
  onlyMine: chat.only_mine,
  defaultListId: chat.default_list_id,
  mine: chat.linked_by === userId,
});

const editableChats = async (project: ProjectContext, userId: string) =>
  (await projectChats(project.id)).filter((chat) => canEditChat(project, chat, userId));

const chatOf = (req: Request): ChatRef => ({
  platform: botPlatformSchema.parse(req.params.platform),
  chatId: chatIdSchema.parse(req.params.chatId),
});

const editableChat = async (project: ProjectContext, ref: ChatRef, userId: string) => {
  const chat = (await projectChats(project.id)).find(
    (item) =>
      item.platform === ref.platform &&
      item.chat_id === ref.chatId &&
      (item.is_group || item.linked_by === userId),
  );
  if (!chat) throw notFound('Chat not found');
  if (!canEditChat(project, chat, userId))
    throw forbidden('Only the person who connected this chat can change it');
  assertWritable(project);
  return chat;
};

export const createProjectBotsRouter = () => {
  const router = Router({ mergeParams: true });

  router.get('/', async (req, res) => {
    const project = projectOf(req);
    const platforms = enabledPlatforms();
    const [access, names, linked, chats] = await Promise.all([
      botAccess(project),
      Promise.all(platforms.map((platform) => PLATFORMS[platform].botName())),
      linkedPlatforms(req.user!.id),
      editableChats(project, req.user!.id),
    ]);
    res.json({
      ...access,
      platforms: platforms.map((platform, index) => ({
        platform,
        botName: names[index]!,
        connected: linked.has(platform),
      })),
      chats: chats
        .filter((chat) => platforms.includes(chat.platform))
        .map((chat) => toChat(chat, req.user!.id)),
    } satisfies BotSettings);
  });

  router.post('/link', async (req, res) => {
    const project = projectOf(req);
    const { platform, target } = botLinkSchema.parse(req.body);
    const { label } = BOT_PLATFORM_META[platform];
    if (!PLATFORMS[platform].enabled()) throw notFound(`The ${label} bot is not set up on this server`);
    if (target === 'group') assertCan(project, 'project.edit');
    assertWritable(project);
    const access = await botAccess(project);
    if (!access.allowed)
      throw paymentRequired(
        `This project's ${label} bot needs the ${PLAN_META[access.requiredPlan].label} plan`,
      );
    const code = await createLinkCode(platform, req.user!.id, project.id, target === 'group');
    const url = await PLATFORMS[platform].linkUrl(code, target === 'group');
    if (!url) throw new HttpError(502, `${label} didn't answer. Try again shortly.`);
    res.json({ platform, code, url } satisfies BotLink);
  });

  router.patch('/chats/:platform/:chatId', async (req, res) => {
    const project = projectOf(req);
    const chat = await editableChat(project, chatOf(req), req.user!.id);
    const patch = updateBotChatSchema.parse(req.body);
    const kinds = kindsFor(project.module === 'household');
    if (patch.notify?.some((kind) => !kinds.includes(kind)))
      throw badRequest('That update is only for households');
    if (patch.defaultListId && !(await listExists(project.id, patch.defaultListId)))
      throw badRequest('Pick a list from this household');
    const ref = { platform: chat.platform, chatId: chat.chat_id };
    await updateChat(ref, project.id, patch);
    const updated = (await projectChats(project.id)).find(
      (item) => item.platform === ref.platform && item.chat_id === ref.chatId,
    )!;
    res.json({ chat: toChat(updated, req.user!.id) });
  });

  router.delete('/chats/:platform/:chatId', async (req, res) => {
    const project = projectOf(req);
    const chat = await editableChat(project, chatOf(req), req.user!.id);
    await deleteChat({ platform: chat.platform, chatId: chat.chat_id }, project.id);
    res.status(204).end();
  });

  return router;
};

export const createMeBotsRouter = () => {
  const router = Router();

  router.delete('/:platform', async (req, res) => {
    await unlinkUser(botPlatformSchema.parse(req.params.platform), req.user!.id);
    res.status(204).end();
  });

  return router;
};
