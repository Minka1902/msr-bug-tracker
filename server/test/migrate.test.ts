import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrate } from '../src/db/migrate';

describe('migrate', () => {
  it('refuses to run when the migrations directory has no SQL files', async () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'msr-migrations-'));
    await expect(migrate(empty)).rejects.toThrow(/No migrations found/);
  });

  it('is a no-op when everything is already applied', async () => {
    await expect(migrate()).resolves.toEqual([]);
  });
});
