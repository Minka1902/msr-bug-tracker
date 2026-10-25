import { createAppleSplashScreens, defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

const BACKGROUND = { light: '#eef2ff', dark: '#0a1023' };

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#4f56f0' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#4f56f0' } },
    appleSplashScreens: createAppleSplashScreens(
      {
        padding: 0.6,
        resizeOptions: { background: BACKGROUND.light, fit: 'contain' },
        darkResizeOptions: { background: BACKGROUND.dark, fit: 'contain' },
        linkMediaOptions: { log: false, addMediaScreen: true, xhtml: false },
      },
      [
        'iPhone 17 Pro Max',
        'iPhone 17 Pro',
        'iPhone Air',
        'iPhone 16 Plus',
        'iPhone 16',
        'iPhone 16e',
        'iPhone 14 Plus',
        'iPhone 13 mini',
        'iPhone 11 Pro Max',
        'iPhone 11',
        'iPhone SE 4.7"',
      ],
    ),
  },
  images: ['public/logo.svg'],
});
