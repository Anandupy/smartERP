import { ApiError, headerRegistry, setUnauthorizedHandler } from "@/core/api";
import {
  createHybridTokenStorage,
  createMemoryTokenStorage,
  getTokenStorage,
  setTokenStorage,
} from "@/core/auth";
import { REQUEST_HEADERS } from "@/constants";

import { authService } from "../api/auth.service";
import type { AuthTokensDto } from "../types/auth.dto";

/**
 * Token lifecycle for the signed-in session: where tokens live, how they are
 * refreshed, and how the API client learns about them.
 *
 * Kept out of React so the refresh path is reachable from the Axios
 * interceptor, which has no component context.
 */

/** Paths that must never trigger recovery — they *are* the recovery. */
const NON_REFRESHABLE = ["/auth/login", "/auth/refresh", "/auth/logout"];

/**
 * The in-flight refresh, if any.
 *
 * Single-flight by construction: concurrent 401s all await this one promise, so
 * a burst of parallel requests produces exactly one `POST /auth/refresh`.
 * Without it, every rotation would race and all but one token would be revoked
 * immediately, logging the user out.
 */
let inflightRefresh: Promise<AuthTokensDto> | null = null;

/**
 * Choose where tokens live for this session.
 *
 * "Remember me" is purely this decision — the backend has no such field, and
 * sending one would fail its `forbidNonWhitelisted` validation. Remembered
 * sessions keep the refresh token in Web Storage so a reload can restore them;
 * otherwise nothing outlives the tab.
 */
export function configureTokenStorage(remember: boolean): void {
  setTokenStorage(
    remember ? createHybridTokenStorage() : createMemoryTokenStorage(),
  );
}

/** Write a freshly issued token pair to the active storage. */
export function persistTokens(tokens: AuthTokensDto): void {
  const storage = getTokenStorage();
  storage.setAccessToken(tokens.accessToken);
  storage.setRefreshToken(tokens.refreshToken);
}

/** Drop every stored credential. */
export function clearTokens(): void {
  getTokenStorage().clear();
}

/**
 * Exchange the stored refresh token for a rotated pair.
 *
 * The backend rotates on every use and revokes the presented token, so callers
 * must never run two of these concurrently — hence the shared promise.
 */
export function refreshSession(): Promise<AuthTokensDto> {
  if (inflightRefresh) return inflightRefresh;

  const refreshToken = getTokenStorage().getRefreshToken();
  if (!refreshToken) {
    return Promise.reject(
      new ApiError({
        kind: "unauthorized",
        status: 401,
        message: "No refresh token available.",
      }),
    );
  }

  inflightRefresh = authService
    .refresh({ refreshToken })
    .then((tokens) => {
      persistTokens(tokens);
      return tokens;
    })
    .catch((error: unknown) => {
      // A refresh failure means the session is unrecoverable; do not leave a
      // dead token behind for the next request to retry with.
      clearTokens();
      throw error;
    })
    .finally(() => {
      inflightRefresh = null;
    });

  return inflightRefresh;
}

/**
 * Wire the auth feature into the API client:
 *
 * - the `Authorization` header now resolves from token storage on every
 *   request, replacing the platform's `null` placeholder;
 * - a 401 triggers one silent refresh and a single replay of the original
 *   request, via the interceptor's existing seam.
 *
 * `onSessionLost` fires when recovery is impossible, so the app can clear its
 * React-side session state and route to `/session-expired`.
 */
export function registerAuthIntegration(onSessionLost: () => void): () => void {
  headerRegistry.register(REQUEST_HEADERS.authorization, () => {
    const token = getTokenStorage().getAccessToken();
    return token ? `Bearer ${token}` : null;
  });

  setUnauthorizedHandler(async (_error, config) => {
    const url = config.url ?? "";
    if (NON_REFRESHABLE.some((path) => url.includes(path))) return false;
    if (!getTokenStorage().getRefreshToken()) return false;

    try {
      await refreshSession();
      return true;
    } catch {
      onSessionLost();
      return false;
    }
  });

  return () => {
    headerRegistry.register(REQUEST_HEADERS.authorization, () => null);
    setUnauthorizedHandler(null);
  };
}
