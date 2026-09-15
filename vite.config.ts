import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      includeAssets: ['icon-v2.svg', 'jiuyong-v2-apple-touch-icon.png'],
      manifest: {
        id: './',
        lang: 'zh-CN',
        name: '久用',
        short_name: '久用',
        description: '记录物品的陪伴时间与使用价值',
        start_url: './#/',
        scope: './',
        display: 'standalone',
        background_color: '#f3f3f1',
        theme_color: '#f3f3f1',
        icons: [
          { src: 'jiuyong-v2-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'jiuyong-v2-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'jiuyong-v2-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,txt}'],
        navigateFallback: 'index.html',
        navigateFallbackAllowlist: [/\/(?:index\.html)?$/],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
