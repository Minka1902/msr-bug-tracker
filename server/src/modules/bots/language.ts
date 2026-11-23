export const BOT_LANGUAGES = ['en', 'he', 'ru'] as const;

export type BotLanguage = (typeof BOT_LANGUAGES)[number];

export const LOCALES: Record<BotLanguage, string> = { en: 'en-GB', he: 'he-IL', ru: 'ru-RU' };

const HEBREW = /[֐-׿]/;
const CYRILLIC = /[Ѐ-ӿ]/;
const LATIN = /[a-z]/i;
const IDENTIFIERS = /\b[a-z][a-z0-9]{1,5}-\d+\b/gi;

export const detectLanguage = (raw: string): BotLanguage | null => {
  if (raw.trimStart().startsWith('/')) return null;
  const text = raw.replace(IDENTIFIERS, '');
  if (HEBREW.test(text)) return 'he';
  if (CYRILLIC.test(text)) return 'ru';
  if (LATIN.test(text)) return 'en';
  return null;
};
