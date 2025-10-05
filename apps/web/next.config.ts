import type { NextConfig } from 'next';
// import nextIntl from './next-intl.config';

const isStaticExport = process.env.NEXT_EXPORT === 'true';

const nextConfig: NextConfig = {
  // Disable i18n for static export (not compatible with App Router + static export)
  // i18n: !isStaticExport ? nextIntl : undefined,
  output: isStaticExport ? 'export' : undefined,
  trailingSlash: true,
  images: {
    unoptimized: true, // Required for static export
  },
  typescript: {
    ignoreBuildErrors: isStaticExport, // Skip type checking for static export
  },
  eslint: {
    ignoreDuringBuilds: isStaticExport, // Skip ESLint for static export
  },
  async rewrites() {
    // Rewrites don't work with static export
    if (isStaticExport) {
      return [];
    }
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
