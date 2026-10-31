import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Prisma's native query engine can abort under Vitest worker threads on
    // Node 24. Separate processes keep the client isolated per worker.
    pool: 'forks',
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
