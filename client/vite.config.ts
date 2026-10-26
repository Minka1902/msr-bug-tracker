import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      pwaAssets: { config: true, overrideManifestIcons: true, injectThemeColor: false },
      manifest: {
        id: '/',
        name: 'MSR Tracker',
        short_name: 'MSR',
        description: 'Projects, tasks and bugs in one place.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#4f56f0',
        background_color: '#0a1023',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,ico}'],
        globIgnores: ['**/apple-splash-*'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/(authorize|token|register|revoke|mcp)(\/|$)/,
          /^\/\.well-known\//,
        ],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      ['/api', '/mcp', '/authorize', '/token', '/register', '/revoke', '/.well-known'].map((path) => [
        path,
        'http://localhost:4000',
      ]),
    ),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
  },
});
