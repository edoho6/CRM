import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source rather than a build artefact, so Next
  // compiles them itself. That keeps `pnpm dev` a single step with no watch-build.
  transpilePackages: ['@clinic/ui', '@clinic/i18n', '@clinic/db', '@clinic/domain'],
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
