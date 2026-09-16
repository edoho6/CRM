import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';
import { securityHeaders } from '@clinic/config/next-headers';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/**
 * The same headers as the staff app, and for a stronger reason.
 *
 * The portal is the surface a patient reaches over the open internet, from
 * whatever device and network they happen to have. It holds less data than the
 * staff app, but the data it does hold belongs to the person reading it, and it
 * is the half of the system an attacker can reach without a staff account.
 *
 * They now come from `@clinic/config/next-headers` rather than being copied
 * here. The two lists were identical byte for byte, which is the duplication
 * that bites: nobody notices when only one of them is edited.
 */
const headers = securityHeaders({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  isDevelopment: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@clinic/ui',
    '@clinic/i18n',
    '@clinic/db',
    '@clinic/domain',
    '@clinic/native',
  ],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers }];
  },
  experimental: {
    // The staff app has had this since it was written; the portal was a copy
    // made before it and never caught up. Without it every `lucide-react`
    // import pulls the whole icon set into the bundle.
    optimizePackageImports: ['lucide-react'],
  },
};

export default withNextIntl(nextConfig);
