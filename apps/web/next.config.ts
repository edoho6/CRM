import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/**
 * Content Security Policy.
 *
 * Written out rather than assembled, so what is permitted is readable in one
 * place. Two entries are concessions rather than choices and are marked as
 * such; the rest are the minimum this app actually needs.
 *
 * `frame-ancestors 'none'` is the one that matters most here: it is what stops
 * the app being framed by another site, which is how a clinical record gets
 * read over a practitioner's shoulder by a page they did not open.
 */
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseOrigin = supabaseHost ? new URL(supabaseHost).origin : '';
const supabaseSocket = supabaseOrigin.replace(/^https/, 'wss');

const csp = [
  "default-src 'self'",
  // Next injects inline bootstrap scripts and, in development, uses eval for
  // fast refresh. Removing 'unsafe-inline' here needs per-request nonces
  // threaded through the app — worth doing, not done yet.
  process.env.NODE_ENV === 'development'
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  // Tailwind ships a stylesheet, but Radix and the chart set inline styles.
  "style-src 'self' 'unsafe-inline'",
  // Herb photographs come from the public Supabase bucket; data: covers inline
  // SVG and the placeholder images.
  `img-src 'self' data: blob: ${supabaseOrigin}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseSocket}`.trim(),
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
]
  .filter(Boolean)
  .join('; ');

/**
 * Headers applied to every response.
 *
 * HSTS is deliberately not set in development: it would pin localhost to HTTPS
 * in the browser's memory and make the dev server unreachable until the pin was
 * cleared by hand.
 */
const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // No feature here needs a camera, a microphone or a location, so none is granted.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source rather than a build artefact, so Next
  // compiles them itself. That keeps `pnpm dev` a single step with no watch-build.
  transpilePackages: ['@clinic/ui', '@clinic/i18n', '@clinic/db', '@clinic/domain'],
  // Server headers are not part of the page, so they cannot leak the framework
  // version to anyone probing.
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
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
