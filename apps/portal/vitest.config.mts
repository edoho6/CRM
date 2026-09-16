import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// The portal had no test script at all: the smoke run opens a few of its signed-
// out pages and nothing else touched it, which left the sign-in — the one door
// in the whole application a patient walks through — with no test behind it.
//
// `.mts` so the config is loaded as ESM, for the same reason as the staff app's.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      // Server modules guard themselves with `import 'server-only'`, which
      // throws here; see lib/test/server-only.ts.
      'server-only': fileURLToPath(new URL('./lib/test/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
  },
});
