import { generateKeyBetween } from 'fractional-indexing';
import { badRequest } from './httpError';

export const positionAfter = (last: string | null | undefined) => generateKeyBetween(last ?? null, null);

export const assertValidPosition = (position: string) => {
  try {
    generateKeyBetween(position, null);
  } catch {
    throw badRequest('Invalid position');
  }
};
