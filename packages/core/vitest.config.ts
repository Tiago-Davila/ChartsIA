import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { conditions: ['@chartsia/source'] },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
