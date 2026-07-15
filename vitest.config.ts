import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['apps/web/e2e/**', '**/node_modules/**', '**/dist/**'],
  },
});
