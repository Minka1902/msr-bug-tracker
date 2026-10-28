import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { botAllowed, minimumBotPlan, PLAN_META } from '@msr/shared/modules';
import { can } from '@msr/shared/permissions';
import { telegramLinkSchema, updateTelegramChatSchema } from '@msr/shared/schemas/telegram';
import { kindsFor } from '@msr/shared/telegram';
import type { TelegramChat, TelegramSettings } from '@msr/shared/types';
import { z } from 'zod';
import { config } from '../../config';
import { HttpError, badRequest, forbidden, notFound, paymentRequired } from '../../lib/httpError';
import { assertCan, assertWritable, projectOf, type ProjectContext } from '../projects/access';
import { currentPlan } from '../shop/service';
import { listExists } from '../shopping/service';
import { botUsername, telegramEnabled } from './api';
import { handleMessage, type TelegramMessage } from './handlers';
import {
  createLinkCode,
  deleteChat,
  hasTelegram,
  projectChats,
  unlinkUser,
  updateChat,
  type ChatRow,
} from './service';

const chatIdSchema = z.coerce.number().int();

const validSecret = (header: string | undefined) => {
  const expected = Buffer.from(config.telegramWebhookSecret);
  const given = Buffer.from(header ?? '');
  return given.length === expected.length && timingSafeEqual(given, expected);
};

const botAccess = async (project: ProjectContext) => {
  const { tier } = await currentPlan(project.ownerId);
  return { allowed: botAllowed(tier, project.module), requiredPlan: minimumBotPlan(project.module) };
};

const canEditChat = (project: ProjectContext, chat: ChatRow, userId: string) =>
  chat.is_group ? can(project.permissions, 'project.edit') : chat.linked_by === userId;

const toChat = (project: ProjectContext, chat: ChatRow, userId: string): TelegramChat => ({
  chatId: chat.chat_id,
  title: chat.title,
  isGroup: chat.is_group,
  notify: chat.notify,
  onlyMine: chat.only_mine,
  defaultListId: chat.default_list_id,
  mine: chat.linked_by === userId,
  canEdit: canEditChat(project, chat, userId),
});

const visibleChats = async (project: ProjectContext, userId: string) =>
  (await projectChats(project.id)).filter((chat) => chat.is_group || chat.linked_by === userId);

const editableChat = async (project: ProjectContext, chatId: number, userId: string) => {
  const chat = (await visibleChats(project, userId)).find((item) => item.chat_id === chatId);
  if (!chat) throw notFound('Chat not found');
  if (!canEditChat(project, chat, userId))
    throw forbidden('Only the person who connected this chat can change it');
  assertWritable(project);
  return chat;
};

export const createProjectTelegramRouter = () => {
  const router = Router({ mergeParams: true });

  router.get('/', async (req, res) => {
    const project = projectOf(req);
    const [access, username, connected, chats] = await Promise.all([
      botAccess(project),
      telegramEnabled() ? botUsername() : null,
      hasTelegram(req.user!.id),
      visibleChats(project, req.user!.id),
    ]);
    res.json({
      enabled: telegramEnabled(),
      ...access,
      botUsername: username,
      connected,
      chats: chats.map((chat) => toChat(project, chat, req.user!.id)),
    } satisfies TelegramSettings);
  });

  router.post('/link', async (req, res) => {
    const project = projectOf(req);
    if (!telegramEnabled()) throw notFound('The Telegram bot is not set up on this server');
    const { target } = telegramLinkSchema.parse(req.body);
    if (target === 'group') assertCan(project, 'project.edit');
    assertWritable(project);
    const access = await botAccess(project);
    if (!access.allowed)
      throw paymentRequired(
        `This project's Telegram bot needs the ${PLAN_META[access.requiredPlan].label} plan`,
      );
    const username = await botUsername();
    if (!username) throw new HttpError(502, "Telegram didn't answer. Try again shortly.");
    const code = await createLinkCode(req.user!.id, project.id, target === 'group');
    res.json({ url: `https://t.me/${username}?${target === 'group' ? 'startgroup' : 'start'}=${code}` });
  });

  router.patch('/chats/:chatId', async (req, res) => {
    const project = projectOf(req);
    const chat = await editableChat(project, chatIdSchema.parse(req.params.chatId), req.user!.id);
    const patch = updateTelegramChatSchema.parse(req.body);
    const kinds = kindsFor(project.module === 'household');
    if (patch.notify?.some((kind) => !kinds.includes(kind)))
      throw badRequest('That update is only for households');
    if (patch.defaultListId && !(await listExists(project.id, patch.defaultListId)))
      throw badRequest('Pick a list from this household');
    await updateChat(chat.chat_id, project.id, patch);
    const updated = (await visibleChats(project, req.user!.id)).find(
      (item) => item.chat_id === chat.chat_id,
    )!;
    res.json({ chat: toChat(project, updated, req.user!.id) });
  });

  router.delete('/chats/:chatId', async (req, res) => {
    const project = projectOf(req);
    const chat = await editableChat(project, chatIdSchema.parse(req.params.chatId), req.user!.id);
    await deleteChat(chat.chat_id, project.id);
    res.status(204).end();
  });

  return router;
};

export const createMeTelegramRouter = () => {
  const router = Router();

  router.delete('/', async (req, res) => {
    await unlinkUser(req.user!.id);
    res.status(204).end();
  });

  return router;
};

export const createTelegramWebhookRouter = () => {
  const router = Router();

  router.post('/telegram/webhook', async (req, res) => {
    if (!validSecret(req.get('x-telegram-bot-api-secret-token'))) {
      res.status(401).end();
      return;
    }
    const message = (req.body as { message?: TelegramMessage }).message;
    const text = message && (await handleMessage(message));
    if (!text) {
      res.status(200).end();
      return;
    }
    res.json({
      method: 'sendMessage',
      chat_id: message.chat.id,
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  });

  return router;
};
