import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const token = req.cookies.get('access_token')?.value;
  const { pathname } = req.nextUrl;

  // Allow auth pages if not signed in; redirect to dashboard if already signed in
  if (pathname.startsWith('/auth')) {
    if (token) {
      const url = req.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Protect app routes
  const protectedPrefixes = [
    '/dashboard',
    '/workouts',
    '/analytics',
    '/nutrition',
    '/profile',
  ];
  if (protectedPrefixes.some((p) => pathname.startsWith(p))) {
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = '/auth/signin';
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|static|public|favicon.ico|images|api|auth).*)'],
};
