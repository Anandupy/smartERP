import { type NextRequest, NextResponse } from 'next/server';

// ============================================================
// Next.js Middleware — Route Protection
//
// Responsibilities:
// 1. Redirect unauthenticated users from (dashboard) to /login
// 2. Redirect authenticated users from (auth) to /dashboard
// 3. Block /setup unless user is SUPER_ADMIN (future enhancement)
//
// NOTE: The middleware runs at the Edge. It cannot access Zustand
// or localStorage. It checks for the presence of a refresh token
// in a cookie (set by the token service after login).
//
// This is a lightweight check — deep session validation happens
// via the API interceptor on the first authenticated request.
// ============================================================

/** Routes accessible without authentication */
const PUBLIC_ROUTES = ['/maintenance'];

/** Auth routes — redirect to dashboard if already authenticated */
const AUTH_ROUTES = ['/login', '/forgot-password', '/reset-password', '/setup'];

/** Protected route prefix — requires authentication */
const PROTECTED_PREFIX = [
  '/dashboard',
  '/admissions',
  '/academic',
  '/students',
  '/attendance',
  '/finance',
  '/hr',
  '/reports',
  '/administration',
  '/settings',
  '/profile',
  '/plugins',
];

/**
 * Check if the request has a refresh token cookie.
 * This is a surface-level check — the actual token validity
 * is verified by the backend on the first API call.
 *
 * NOTE: The refresh token is currently stored in localStorage,
 * NOT as a cookie. This means the middleware cannot check it.
 * Client-side AuthGuard handles the actual protection.
 *
 * This middleware provides a UX fast-path only.
 * When migrated to HttpOnly cookies, update this function.
 */
function hasAuthIndicator(request: NextRequest): boolean {
  // Future: Check HttpOnly cookie here
  // const cookie = request.cookies.get('__eduos_rt__');
  // return !!cookie?.value;

  // For now: Check a lightweight auth indicator cookie
  // set by the client after successful login
  const authIndicator = request.cookies.get('eduos-auth-indicator');
  return !!authIndicator?.value;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const isAuthenticated = hasAuthIndicator(request);

  // Root redirect
  if (pathname === '/') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Auth routes — redirect authenticated users to dashboard
  if (AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Protected routes — redirect unauthenticated users to login
  if (PROTECTED_PREFIX.some((prefix) => pathname.startsWith(prefix))) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', request.url);
      // Preserve the intended destination for post-login redirect
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - Files with extensions (.png, .jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
