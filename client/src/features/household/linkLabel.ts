import { STORE_LABELS, storeOf } from '@msr/shared/sharedLink';

export const linkLabel = (url: string) => {
  const store = storeOf(url);
  if (store) return STORE_LABELS[store];
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};
