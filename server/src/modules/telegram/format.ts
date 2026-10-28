import { config } from '../../config';

export const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const link = (path: string, text: string) =>
  `<a href="${new URL(path, config.APP_URL).href}">${escape(text)}</a>`;

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
