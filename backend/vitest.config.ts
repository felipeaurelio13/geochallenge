import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    pool: 'vmThreads',
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
