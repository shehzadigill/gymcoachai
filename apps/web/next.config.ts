import type { NextConfig } from 'next';
import nextIntl from './next-intl.config';

const nextConfig: NextConfig = {
  i18n: nextIntl,
  async rewrites() {
    const nutritionUrl = process.env.NEXT_PUBLIC_NUTRITION_URL;
    const cfBase = process.env.NEXT_PUBLIC_CLOUDFRONT_URL;
    const rules: any[] = [];
    // Prefer direct Nutrition service URL in dev if provided
    if (nutritionUrl) {
      rules.push({
        source: '/api/nutrition/:path*',
        destination: `${nutritionUrl}/api/nutrition/:path*`,
      });
    }
    if (cfBase) {
      rules.push({
        source: '/api/:path*',
        destination: `${cfBase}/api/:path*`,
      });
    }
    return rules;
  },
};

export default nextConfig;
