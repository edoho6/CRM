import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// `.mts` so the config is loaded as ESM. As plain `.ts` under a CommonJS
// package.json, Vite's native config loader warns on every run.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
  },
});
