import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { apiPost, PASSWORD, signUp } from './helpers';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const totp = (secret: string, offsetSteps = 0) => {
  const bits = [...secret.replace(/=+$/, '')]
    .map((char) => BASE32.indexOf(char).toString(2).padStart(5, '0'))
    .join('');
  const key = Buffer.from(bits.match(/.{8}/g)!.map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000) + offsetSteps));
  const hash = createHmac('sha1', key).update(counter).digest();
  const offset = hash[hash.length - 1]! & 0xf;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
};

test('signs in with an authenticator code after turning on 2FA', async ({ page }) => {
  const user = await signUp(page, 'Tess Factor', 'twofactor');
  const { secret } = await apiPost<{ secret: string }>(page, '/me/2fa/setup', { password: PASSWORD });
  const { recoveryCodes } = await apiPost<{ recoveryCodes: string[] }>(page, '/me/2fa/enable', {
    code: totp(secret),
  });
  expect(recoveryCodes).toHaveLength(10);
  await apiPost(page, '/auth/logout');

  await page.goto('/login');
  await page.locator('#email').fill(user.email);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('Authentication code').fill(totp(secret, 1));
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page).toHaveURL('/');

  await apiPost(page, '/auth/logout');
  await page.goto('/login');
  await page.locator('#email').fill(user.email);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Use a recovery code' }).click();
  await page.getByLabel('Recovery code').fill(recoveryCodes[0]!);
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page).toHaveURL('/');
});
