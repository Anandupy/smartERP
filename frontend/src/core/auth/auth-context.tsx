"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { getTokenStorage } from "./token-storage";
import type { AuthContextValue, AuthUser, TokenPair } from "./types";

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Authentication context provider.
 *
 * This ships the *shape* and local state machine of auth without any network
 * calls — the backend login/refresh flow is not finalized. When it is, the
 * login mutation calls `setSession`; nothing else in the app needs to change.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const setSession = useCallback((nextUser: AuthUser, tokens: TokenPair) => {
    const storage = getTokenStorage();
    storage.setAccessToken(tokens.accessToken);
    storage.setRefreshToken(tokens.refreshToken ?? null);
    setUser(nextUser);
  }, []);

  const replaceUser = useCallback((nextUser: AuthUser) => {
    setUser(nextUser);
  }, []);

  const clearSession = useCallback(() => {
    getTokenStorage().clear();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status: user ? "authenticated" : "unauthenticated",
      isAuthenticated: user !== null,
      setSession,
      setUser: replaceUser,
      clearSession,
    }),
    [user, setSession, replaceUser, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an <AuthProvider>.");
  }
  return context;
}
