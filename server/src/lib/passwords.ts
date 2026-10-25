import { hash, verify } from '@node-rs/argon2';

const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

let dummyHash: Promise<string> | undefined;

export const hashPassword = (password: string) => hash(password, OPTIONS);

export const verifyPassword = async (passwordHash: string | null | undefined, password: string) => {
  try {
    return await verify(passwordHash ?? (await (dummyHash ??= hashPassword('timing-equalizer'))), password);
  } catch {
    return false;
  }
};
