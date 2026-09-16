import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';
import { securityHeaders } from '@clinic/config/next-headers';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

/**
 * The headers — Content Security Policy included — live in
 * `@clinic/config/next-headers`, shared with the patient portal, because they
 * are the one part of these two configs that must never drift apart. What stays
 * here is what is genuinely particular to the staff app.
 */
const headers = securityHeaders({
  supabaseUrl,
  isDevelopment: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /*
   * Pictures, resized to what is actually on screen.
   *
   * The reference photographs are 640 px on the longest side — small for a card
   * and twenty times too big for the 48 px square a list row draws them in. Four
   * hundred herbs at that ratio is megabytes of catalogue page spent on squares
   * the size of a fingernail. `next/image` asks for the width the layout needs
   * and serves AVIF or WebP where the browser takes it.
   *
   * `remotePatterns` covers a clinic's own upload, which lives in the Supabase
   * bucket rather than in `public/` — the same origin the CSP already allows
   * pictures from, derived from the same variable so the two cannot drift.
   */
  images: {
    remotePatterns: supabaseUrl
      ? [{ protocol: 'https', hostname: new URL(supabaseUrl).hostname }]
      : [],
  },
  // Workspace packages ship TypeScript source rather than a build artefact, so Next
  // compiles them itself. That keeps `pnpm dev` a single step with no watch-build.
  transpilePackages: [
    '@clinic/ui',
    '@clinic/i18n',
    '@clinic/db',
    '@clinic/domain',
    '@clinic/native',
  ],
  // Server headers are not part of the page, so they cannot leak the framework
  // version to anyone probing.
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers }];
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
    // Server Actions cap request bodies at 1MB by default, which a scanned intake
    // form or a phone photo blows past immediately. 15MB comfortably covers a
    // multi-page PDF or a full-resolution photo from a patient's document.
    serverActions: {
      bodySizeLimit: '15mb',
    },
  },
};

export default withNextIntl(nextConfig);
