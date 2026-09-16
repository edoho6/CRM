/**
 * The security headers, written once for both applications.
 *
 * They were duplicated — byte for byte, which is the dangerous kind of
 * duplication: identical today, and quietly not identical the first time one of
 * them is edited. Everything else about the two `next.config.ts` files differs
 * for a reason (the staff app optimises herb photographs and accepts large
 * uploads; the portal does neither), and those differences stay where they are.
 * This is the part that must never differ.
 *
 * `frame-ancestors 'none'` is the one that matters most: it is what stops either
 * app being framed by another site, which is how a clinical record gets read
 * over a practitioner's shoulder by a page they did not open.
 *
 * Plain JavaScript rather than TypeScript because `next.config.ts` is loaded
 * before anything in this repo is compiled.
 *
 * @param {object} options
 * @param {string} options.supabaseUrl  `NEXT_PUBLIC_SUPABASE_URL`, or '' when unset.
 * @param {boolean} options.isDevelopment
 * @returns {{ key: string, value: string }[]}
 */
export function securityHeaders({ supabaseUrl, isDevelopment }) {
  const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : '';
  const supabaseSocket = supabaseOrigin.replace(/^https/, 'wss');

  const csp = [
    "default-src 'self'",
    // Next injects inline bootstrap scripts and, in development, uses eval for
    // fast refresh. Removing 'unsafe-inline' here needs per-request nonces
    // threaded through the app — worth doing, not done yet.
    isDevelopment
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'",
    // Tailwind ships a stylesheet, but Radix and the chart set inline styles.
    "style-src 'self' 'unsafe-inline'",
    // Photographs come from the public Supabase bucket; data: covers inline SVG
    // and the placeholder images.
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

  return [
    { key: 'Content-Security-Policy', value: csp },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // No feature in either app needs a camera, a microphone or a location, so
    // none is granted.
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    },
    { key: 'X-DNS-Prefetch-Control', value: 'off' },
    // HSTS is deliberately not set in development: it would pin localhost to
    // HTTPS in the browser's memory and make the dev server unreachable until
    // the pin was cleared by hand.
    ...(isDevelopment
      ? []
      : [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ]),
  ];
}
