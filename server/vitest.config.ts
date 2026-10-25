import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { NODE_ENV: 'test' },
    globalSetup: ['test/globalSetup.ts'],
    setupFiles: ['test/setup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
  },
});
