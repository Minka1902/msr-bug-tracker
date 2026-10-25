const BASE = 'http://app.invalid';

export const safeNextPath = (value: string | null) => {
  if (!value?.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  const url = new URL(value, BASE);
  return url.origin === BASE ? `${url.pathname}${url.search}${url.hash}` : '/';
};
