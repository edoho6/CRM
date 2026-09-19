import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

/**
 * The linter, restored.
 *
 * `next lint` was removed in Next 16, and with it the only linting this repo
 * had — so `pnpm lint` failed with "no such directory: apps/web/lint" and
 * nobody noticed, because nothing in CI ran it. Twenty `eslint-disable`
 * comments sat in the code claiming to silence rules that no longer ran at all.
 *
 * ESLint is pinned to 9 rather than 10 on purpose: three of the plugins
 * `eslint-config-next` brings with it (import, react, jsx-a11y) still declare
 * eslint 9 as their ceiling, and a linter that crashes on a plugin mismatch is
 * worse than no linter. Revisit when those three ship eslint 10 support.
 */
const config = [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/test-results/**',
      '**/snapshots/**',
      '**/.auth/**',
      'packages/native/android/**',
      'packages/native/ios/**',
      // Capacitor copies the built web app and its own bridge into the two
      // store shells. Generated output, checked in only so a store build does
      // not need a web build first.
      'apps/mobile-clinic/android/**',
      'apps/mobile-clinic/ios/**',
      'apps/mobile-portal/android/**',
      'apps/mobile-portal/ios/**',
      // Deno, not Node: URL imports and a `Deno` global that the resolver and
      // the TypeScript rules here would both reject. `deno check` is that
      // code's own gate, and it runs where those functions are deployed.
      'supabase/functions/**',
    ],
  },

  ...nextCoreWebVitals,
  ...nextTypeScript,

  {
    // Two applications in one repo: without this the Next plugin looks for a
    // single app at the root, finds none, and reports every page as missing.
    settings: { next: { rootDir: ['apps/web/', 'apps/portal/'] } },
  },

  {
    rules: {
      // An unused argument is usually a signature being honoured (a callback
      // that takes an event it does not read), so name it with a leading
      // underscore and it stops being a finding. `ignoreRestSiblings` keeps the
      // deliberate "destructure to drop these fields" idiom — the one that
      // builds the writer's sheet in scripts/catalogue/write.mjs — from reading
      // as seven dead variables.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      /*
       * The React Compiler diagnostics, which arrived with react-hooks 7.
       *
       * They are warnings and not errors on purpose, and the distinction is not
       * "we disagree with them". They are real, and one group is a bug this
       * project already knew about: `react-hooks/purity` fires in eight places
       * that read the clock while rendering, which is what makes the server's
       * HTML and the browser's first paint disagree (React #418). Fixing them
       * means the `renderedAt` pattern from dashboard-context.tsx, file by
       * file, and that is its own round of work — not something to bundle into
       * the commit that installs the linter.
       *
       * The count is held down by `--max-warnings` in the lint script, so this
       * list can shrink and cannot grow. It reached zero on 19.9 — the patterns
       * that got it there are in CLAUDE.md under "לפני commit".
       */
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/incompatible-library': 'warn',

      /*
       * `<img>` rather than next/image, deliberately (19.9). Every picture here
       * is sized before it ships — the herb and medicine photos are cut to their
       * thumbnail by the scripts that fetch them (69 kB to 3.5 kB, performance
       * round 3), the page screenshots are webp at their drawn size — so the
       * optimiser would only re-encode what is already small, and on Vercel it
       * bills per source image, hundreds of them. And two cannot go through it
       * at all: a handwritten sketch is served only to a signed-in reader, whose
       * cookie the optimiser's fetch would not carry, and the two-step QR code
       * is the secret itself, which has no business in an image cache.
       */
      '@next/next/no-img-element': 'off',
    },
  },

  {
    // The scripts are plain Node ESM run from a terminal, not part of either
    // application: no pages to link to, and `console` is their whole interface.
    files: ['scripts/**/*.mjs', '*.mjs'],
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
];

export default config;
