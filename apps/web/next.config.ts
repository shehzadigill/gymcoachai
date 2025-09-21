import type { NextConfig } from 'next';
import nextIntl from './next-intl.config';

const nextConfig: NextConfig = {
  i18n: nextIntl,
  async rewrites() {
    const base = process.env.NEXT_PUBLIC_CLOUDFRONT_URL;
    if (!base) {
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: `${base}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
