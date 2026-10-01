import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    __BUILD_SHA__: JSON.stringify(process.env.VITE_BUILD_SHA ?? 'unknown'),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['geochallenge-mark.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'GeoChallenge',
        short_name: 'GeoChallenge',
        description: 'Juego de geografía con banderas, capitales y mapas.',
        theme_color: '#0D5144',
        background_color: '#F4F6F1',
        display: 'standalone',
        orientation: 'portrait-primary',
        categories: ['games', 'education'],
        lang: 'es',
        dir: 'ltr',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,jpeg,svg,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url, request }: { url: URL; request: Request }) =>
              request.destination === 'image' &&
              [
                'flagcdn.com',
                'flagpedia.net',
                'cdn.jsdelivr.net',
                'raw.githubusercontent.com',
                'upload.wikimedia.org',
                'commons.wikimedia.org', // monument URLs (Special:FilePath) redirect to upload.wikimedia.org
              ].includes(url.hostname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'game-images',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
});
