export const PROJECT_KEY_REGEX = /^[A-Z][A-Z0-9]{1,5}$/;
export const IDENTIFIER_REGEX = /^([A-Za-z][A-Za-z0-9]{1,5})-(\d{1,9})$/;

const BRANCH_MAX = 60;

export const formatIdentifier = (key: string, number: number) => `${key.toUpperCase()}-${number}`;

export const parseIdentifier = (value: string) => {
  const match = IDENTIFIER_REGEX.exec(value.trim());
  return match ? { key: match[1]!.toUpperCase(), number: Number(match[2]) } : null;
};

export const suggestProjectKey = (name: string) => {
  const words = name
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const raw =
    words.length > 1
      ? words.map((word) => word[0]).join('')
      : (words[0] ?? '').replace(/[aeiou]/gi, '').slice(0, 3) || words[0] || '';
  const key = raw
    .toUpperCase()
    .replace(/^[0-9]+/, '')
    .slice(0, 6);
  return key.length >= 2 ? key : (key + 'PRJ').slice(0, 3);
};

export const slugify = (value: string) =>
  value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const branchName = (key: string, number: number, title: string) =>
  `${key.toLowerCase()}-${number}-${slugify(title)}`.slice(0, BRANCH_MAX).replace(/-+$/, '');
