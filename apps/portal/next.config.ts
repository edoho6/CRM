import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@clinic/ui', '@clinic/i18n', '@clinic/db', '@clinic/domain'],
};

export default withNextIntl(nextConfig);
