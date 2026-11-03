import { logger } from '../../../lib/logger';
import { handleMessage } from '../handlers';
import { channelTitle, sendDiscord } from './api';

export interface DiscordMessage {
  channel_id: string;
  guild_id?: string;
  content: string;
  author: { id: string; username: string; global_name?: string | null; bot?: boolean };
  mentions?: { id: string }[];
}

export const handleDiscordMessage = async (message: DiscordMessage, botId: string | null) => {
  if (message.author.bot) return;
  const isGroup = !!message.guild_id;
  const text = await handleMessage({
    platform: 'discord',
    chatId: message.channel_id,
    isGroup,
    senderId: message.author.id,
    text: message.content,
    title: async () =>
      isGroup
        ? channelTitle(message.channel_id, message.guild_id!)
        : (message.author.global_name ?? message.author.username),
    quietWhenUnlinked: isGroup && !message.mentions?.some((user) => user.id === botId),
  });
  if (!text) return;
  const answer = await sendDiscord(message.channel_id, text);
  if (!answer.ok) logger.warn({ channelId: message.channel_id, error: answer.error }, 'Discord reply failed');
};
