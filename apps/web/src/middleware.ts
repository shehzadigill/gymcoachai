/**
 * IMPORTANT: This middleware does NOT work with static exports (output: 'export')
 *
 * For static exports to S3/CloudFront:
 * - Client-side locale detection is handled by LocaleRedirect component in app/page.tsx
 * - CloudFront function handles root path redirection (see infrastructure/src/gymcoach-ai-stack.ts)
 *
 * This middleware is kept for reference and will only run if you switch to a server-based deployment.
 */

import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/config';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware({
  // A list of all locales that are supported
  locales,

  // Used when no locale matches
  defaultLocale,

  // Always use locale prefix to ensure proper routing
  localePrefix: 'always',
});

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the pathname already has a locale prefix
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  // If pathname doesn't have a locale, redirect based on stored preference or default
  if (!pathnameHasLocale && pathname === '/') {
    // Try to get preferred locale from cookie (set by client-side)
    const preferredLocale = request.cookies.get('preferredLocale')?.value;

    // Use preferred locale if valid, otherwise use default
    const targetLocale =
      preferredLocale && locales.includes(preferredLocale as any)
        ? preferredLocale
        : defaultLocale;

    // Redirect to the locale-prefixed path
    const url = request.nextUrl.clone();
    url.pathname = `/${targetLocale}${pathname}`;
    return NextResponse.redirect(url);
  }

  // For all other cases, use the default next-intl middleware
  return intlMiddleware(request);
}

export const config = {
  // Match only internationalized pathnames
  matcher: [
    // Match all pathnames except for
    // - API routes
    // - _next (Next.js internals)
    // - _static (inside /public)
    // - all root files inside /public (e.g. favicon.ico)
    '/((?!api|_next|_static|.*\\..*).*)',
  ],
};
