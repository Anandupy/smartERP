'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useIsHydrated } from '@/hooks/use-is-hydrated';
import { tokenService } from '@/lib/api/token-service';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * Client-side authentication guard.
 * Renders a loading state until auth is confirmed.
 * Redirects to /login if not authenticated.
 *
 * This complements the middleware which provides edge-level protection.
 * The guard handles the case where localStorage refresh token has expired.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const isHydrated = useIsHydrated();

  useEffect(() => {
    if (!isHydrated) return;
    if (!isInitialized) return;

    if (!isAuthenticated) {
      // Not authenticated after hydration — redirect to login
      router.replace('/login');
    }
  }, [isAuthenticated, isInitialized, isHydrated, router]);

  // During hydration, show nothing to prevent flash
  if (!isHydrated || !isInitialized) {
    return <AuthLoadingScreen />;
  }

  // Not authenticated — render nothing while redirect fires
  if (!isAuthenticated) {
    return <AuthLoadingScreen />;
  }

  return <>{children}</>;
}

/**
 * Minimal loading screen shown during auth initialization.
 * Matches the app shell dimensions to prevent layout shift.
 */
function AuthLoadingScreen() {
  return (
    <div
      className="flex h-screen w-full items-center justify-center bg-background"
      role="status"
      aria-label="Authenticating..."
    >
      <div className="flex flex-col items-center gap-3">
        {/* Spinner */}
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
        <p className="text-sm text-text-muted">Loading EduOS...</p>
      </div>
    </div>
  );
}

/**
 * Hook to perform silent token refresh on app boot.
 * Call this inside the (dashboard) layout after the store is hydrated.
 */
export function useAuthBootstrap() {
  const setUser = useAuthStore((s) => s.setUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const setInitialized = useAuthStore((s) => s.setInitialized);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const isHydrated = useIsHydrated();

  useEffect(() => {
    if (!isHydrated || isInitialized) return;

    // Check if we have a refresh token to attempt silent refresh
    if (!tokenService.hasRefreshToken()) {
      clearAuth();
      return;
    }

    // Attempt silent token refresh
    // This is done lazily — the first 401 will trigger it via interceptor
    // Here we just mark initialized if we have a refresh token
    // The actual token validation happens on first API call
    setInitialized();
  }, [isHydrated, isInitialized, setUser, clearAuth, setInitialized]);
}
