import { config } from '../../config';

export interface Formatter {
  text: (value: string) => string;
  bold: (value: string) => string;
  code: (value: string) => string;
  link: (path: string, label: string) => string;
}

const urlOf = (path: string) => new URL(path, config.APP_URL).href;

const html = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const markdown = (value: string) => value.replace(/[\\*_~`|<>[\]()#-]/g, '\\$&');

export const telegramFormat: Formatter = {
  text: html,
  bold: (value) => `<b>${html(value)}</b>`,
  code: (value) => `<code>${html(value)}</code>`,
  link: (path, label) => `<a href="${urlOf(path)}">${html(label)}</a>`,
};

export const discordFormat: Formatter = {
  text: markdown,
  bold: (value) => `**${markdown(value)}**`,
  code: (value) => `\`${value.replace(/`/g, "'")}\``,
  link: (path, label) => `[${markdown(label)}](<${urlOf(path)}>)`,
};

export const localToday = (timezone: string, at = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(at);

export const formatDay = (day: string, timezone: string) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`)) + (day === localToday(timezone) ? ' (today)' : '');

export const formatTime = (instant: string | Date, timezone: string) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(new Date(instant));
