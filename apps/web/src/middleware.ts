// Temporarily disable i18n middleware to fix setup
// import createMiddleware from 'next-intl/middleware';
// import { locales, defaultLocale } from './i18n/config';

// export default createMiddleware({
//   // A list of all locales that are supported
//   locales,

//   // Used when no locale matches
//   defaultLocale,

//   // Use locale prefix only when needed to avoid conflicts
//   localePrefix: 'as-needed',
// });

// export const config = {
//   // Match only internationalized pathnames
//   matcher: [
//     // Match all pathnames except for
//     // - API routes
//     // - _next (Next.js internals)
//     // - _static (inside /public)
//     // - all root files inside /public (e.g. favicon.ico)
//     '/((?!api|_next|_static|.*\\..*).*)',
//   ],
// };

export default function middleware() {
  // No-op middleware for now
}

export const config = {
  matcher: [],
};
