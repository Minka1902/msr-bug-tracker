import { describe, expect, it } from 'vitest';
import { openSecret, sealSecret } from '../src/lib/secretBox';

describe('secret box', () => {
  it('round-trips, uses a fresh IV each time and rejects tampering', () => {
    const sealed = sealSecret('sk-ant-secret');
    expect(sealed).toMatch(/^v1\./);
    expect(sealed).not.toContain('sk-ant-secret');
    expect(sealSecret('sk-ant-secret')).not.toBe(sealed);
    expect(openSecret(sealed)).toBe('sk-ant-secret');
    const [version, iv, tag, data] = sealed.split('.');
    const flipped = Buffer.from(data!, 'base64url');
    flipped[0]! ^= 1;
    expect(() => openSecret([version, iv, tag, flipped.toString('base64url')].join('.'))).toThrow();
  });
});
