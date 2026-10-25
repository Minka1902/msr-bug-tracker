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
});
