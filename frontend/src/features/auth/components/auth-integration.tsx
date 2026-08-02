"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { ROUTES } from "@/constants";
import { getTokenStorage, useAuth } from "@/core/auth";
import { getWorkspaceState } from "@/core/workspace";

import { toAuthUser, toTokenPair } from "../mappers/auth.mapper";
import { decodeAccessToken } from "../utils/jwt";
import {
  clearTokens,
  configureTokenStorage,
  refreshSession,
  registerAuthIntegration,
} from "../utils/session-manager";

/**
 * Connects the auth feature to the API client, and restores a remembered
 * session on start-up.
 *
 * Mounted once, near the root. It renders nothing — its whole job is the wiring
 * that has to exist before the first request goes out:
 *
 * 1. the `Authorization` header resolves from token storage, replacing the
 *    platform's placeholder;
 * 2. a 401 triggers one silent, single-flight refresh and one replay;
 * 3. a remembered refresh token is exchanged for a live session, so a reload
 *    does not look like a logout.
 *
 * Restoration deliberately runs before anything else can fetch: the access
 * token lives only in memory, so after a reload every request would 401 until
 * this completes.
 */
export function AuthIntegration() {
  const router = useRouter();
  const { setSession, clearSession } = useAuth();

  // The wiring is global and registered once, so the callback is held in a ref
  // rather than a dependency — re-registering on every render would tear down
  // the interceptor mid-flight.
  const sessionLostRef = useRef<() => void>(() => {});

  useEffect(() => {
    sessionLostRef.current = () => {
      clearSession();
      // The scope outlives the session in storage, so an unrecoverable 401 has
      // to drop it too — otherwise the next sign-in inherits a stale campus.
      getWorkspaceState().clear();
      router.replace(ROUTES.auth.sessionExpired);
    };
  }, [clearSession, router]);

  useEffect(() => {
    return registerAuthIntegration(() => sessionLostRef.current());
  }, []);

  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    // Only a remembered session persists a refresh token; anything else starts
    // signed out, which is exactly what "do not remember me" should mean.
    configureTokenStorage(true);
    if (!getTokenStorage().getRefreshToken()) return;

    let cancelled = false;
    void refreshSession()
      .then((tokens) => {
        if (cancelled) return;
        const claims = decodeAccessToken(tokens.accessToken);
        if (claims) setSession(toAuthUser(claims), toTokenPair(tokens));
      })
      .catch(() => {
        // An unusable refresh token is not an error the user can act on: clear
        // it and let them sign in normally.
        clearTokens();
      });

    return () => {
      cancelled = true;
    };
  }, [setSession]);

  return null;
}
