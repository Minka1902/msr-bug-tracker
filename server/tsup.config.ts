import fs from 'node:fs/promises';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/db/migrateCli.ts', 'src/modules/demo/seedCli.ts'],
  format: 'esm',
  target: 'node22',
  platform: 'node',
  noExternal: ['@msr/shared'],
  clean: true,
  sourcemap: true,
  publicDir: false,
  onSuccess: async () => {
    await fs.cp('src/db/migrations', 'dist/migrations', { recursive: true });
    await fs.cp('src/modules/demo/assets', 'dist/assets', { recursive: true });
  },
});
