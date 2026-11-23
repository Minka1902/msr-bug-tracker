export const STORES = ['aliexpress', 'amazon', 'shein'] as const;

export type Store = (typeof STORES)[number];

export const STORE_LABELS: Record<Store, string> = {
  aliexpress: 'AliExpress',
  amazon: 'Amazon',
  shein: 'SHEIN',
};
export const LINK_URL_MAX = 2000;

const NAME_MAX = 120;
const URL_IN_TEXT = /https?:\/\/[^\s<>"'“”]+/gi;
const STORE_HOSTS: Record<Store, RegExp> = {
  aliexpress: /(?:^|\.)aliexpress\.(?:com|us|ru)$/,
  amazon: /(?:^|\.)amazon\.[a-z.]{2,6}$|^(?:amzn\.to|amzn\.eu|a\.co)$/,
  shein: /(?:^|\.)shein\.com$/,
};
const BOILERPLATE = [
  /\b(?:i\s+)?(?:just\s+)?found\s+(?:this|it)\s+on\s+(?:aliexpress|amazon|shein)\b[,:!.]*/gi,
  /\bcheck\s+out\s+this(?:\s+(?:deal|product|item))?(?:\s+(?:on|at|from)\s+(?:aliexpress|amazon|shein))?\b[:!.,]*/gi,
  /\bcheck\s+(?:it|this)\s+out\b[!.:,]*/gi,
  /\b(?:shop|buy)\s+this\s+(?:item|product)\s+on\s+(?:aliexpress|amazon|shein)\b[:!.,]*/gi,
  /\bjust\s+look\s+at\s+it\b[:!.,]*/gi,
  /(?:\bonly\s+)?(?:\b(?:us|usd|ils|eur)\s*)?[$€£₪]\s?\d+(?:[.,]\d+)?(?:\s*\||\s+for\b)?/gi,
];
const EDGES = /^[\s"'“”«»:|\-–—!.,]+|[\s"'“”«»:|\-–—!.,]+$/g;
const SLUGS = [/\/([^/]+)\/dp\//, /\/([^/?#]+)-p-\d+/];

const urlOf = (value: string) => {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) ? url : null;
  } catch {
    return null;
  }
};

const firstUrl = (...texts: (string | undefined)[]) => {
  for (const text of texts) {
    const found = text?.match(URL_IN_TEXT)?.[0]?.replace(/[).,;!?]+$/, '');
    if (found && urlOf(found)) return found;
  }
  return null;
};

const words = (slug: string) => {
  try {
    return decodeURIComponent(slug)
      .replace(/\.html?$/, '')
      .replace(/[-_+]+/g, ' ')
      .trim();
  } catch {
    return '';
  }
};

const cleanName = (text: string | undefined) => {
  if (!text) return '';
  const cleaned = BOILERPLATE.reduce(
    (value, pattern) => value.replace(pattern, ' '),
    text.replace(URL_IN_TEXT, ' '),
  )
    .replace(/\s+/g, ' ')
    .replace(EDGES, '');
  return STORES.some((store) => STORE_LABELS[store].toLowerCase() === cleaned.toLowerCase()) ? '' : cleaned;
};

const slugName = (url: URL) => {
  for (const pattern of SLUGS) {
    const match = url.pathname.match(pattern);
    if (match) return words(match[1]!);
  }
  const last = url.pathname.split('/').filter(Boolean).at(-1) ?? '';
  return /[a-z]/i.test(last) && last.includes('-') ? words(last) : '';
};

export const storeOf = (value: string): Store | null => {
  const host = urlOf(value)?.hostname.toLowerCase();
  return (host && STORES.find((store) => STORE_HOSTS[store].test(host))) || null;
};

export const trimUrl = (url: string) =>
  url.length > LINK_URL_MAX ? url.split(/[?#]/)[0]!.slice(0, LINK_URL_MAX) : url;

export const parseSharedLink = ({ title, text, url }: { title?: string; text?: string; url?: string }) => {
  const link = firstUrl(url, text, title);
  const parsed = link ? urlOf(link)! : null;
  const store = link ? storeOf(link) : null;
  const name =
    cleanName(title) ||
    cleanName(text) ||
    (parsed && slugName(parsed)) ||
    (store ? `${STORE_LABELS[store]} item` : (parsed?.hostname.replace(/^www\./, '') ?? ''));
  return { name: name.slice(0, NAME_MAX), url: link && trimUrl(link), store };
};
