import type { NextConfig } from 'next';
import withPWA from 'next-pwa';
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
  // async rewrites() {
  //   // Rewrites don't work with static export
  //   if (isStaticExport) {
  //     return [];
  //   }
  //   const nutritionUrl = process.env.NEXT_PUBLIC_NUTRITION_URL;
  //   const cfBase = process.env.NEXT_PUBLIC_CLOUDFRONT_URL;
  //   const rules: any[] = [];
  //   // Prefer direct Nutrition service URL in dev if provided
  //   if (nutritionUrl) {
  //     rules.push({
  //       source: '/api/nutrition/:path*',
  //       destination: `${nutritionUrl}/api/nutrition/:path*`,
  //     });
  //   }
  //   if (cfBase) {
  //     rules.push({
  //       source: '/api/:path*',
  //       destination: `${cfBase}/api/:path*`,
  //     });
  //   }
  //   return rules;
  // },
};

const pwaConfig = {
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/middleware-manifest\.json$/],
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 365 days
        },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts-static',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 365 days
        },
      },
    },
    {
      urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-font-assets',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        },
      },
    },
    {
      urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-image-assets',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: /\/_next\/image\?url=.+$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-image',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: /\.(?:mp3|wav|ogg)$/i,
      handler: 'CacheFirst',
      options: {
        rangeRequests: true,
        cacheName: 'static-audio-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: /\.(?:mp4)$/i,
      handler: 'CacheFirst',
      options: {
        rangeRequests: true,
        cacheName: 'static-video-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: /\.(?:js)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-js-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: /\.(?:css|less)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-style-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: /^https:\/\/.*\.(?:eot|otf|ttc|ttf|woff|woff2)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'google-fonts-webfonts',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'google-fonts-api',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        },
      },
    },
  ],
};

export default withPWA(pwaConfig)(nextConfig);
