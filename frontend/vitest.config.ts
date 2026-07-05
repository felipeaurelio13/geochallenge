import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // vite-plugin-pwa injects this virtual module at build/dev time via
      // VitePWA(), which isn't registered in this test-only Vite config —
      // alias it to a lightweight stand-in so components importing
      // usePwaUpdateNotice.ts (AppRoot.tsx) can still be rendered in tests.
      'virtual:pwa-register/react': resolve(__dirname, './src/__tests__/mocks/pwaRegisterReact.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
