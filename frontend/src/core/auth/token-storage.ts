import { STORAGE_KEYS } from "@/constants";
import type { Nullable } from "@/types/common";

/**
 * Storage abstraction for auth tokens. The concrete backing store is swappable:
 * in-memory (default, most XSS-resistant for the access token), Web Storage, or
 * an HTTP-only-cookie no-op once the backend moves refresh tokens to cookies.
 */
export interface TokenStorage {
  getAccessToken(): Nullable<string>;
  setAccessToken(token: Nullable<string>): void;
  getRefreshToken(): Nullable<string>;
  setRefreshToken(token: Nullable<string>): void;
  clear(): void;
}

/** Default: keep tokens in memory only. Cleared on full page reload. */
export function createMemoryTokenStorage(): TokenStorage {
  let accessToken: Nullable<string> = null;
  let refreshToken: Nullable<string> = null;

  return {
    getAccessToken: () => accessToken,
    setAccessToken: (token) => {
      accessToken = token;
    },
    getRefreshToken: () => refreshToken,
    setRefreshToken: (token) => {
      refreshToken = token;
    },
    clear: () => {
      accessToken = null;
      refreshToken = null;
    },
  };
}

const hasWindow = typeof window !== "undefined";

/** Web Storage backed implementation, guarded for SSR. */
export function createWebTokenStorage(
  storage: Storage | undefined = hasWindow ? window.localStorage : undefined,
): TokenStorage {
  const read = (key: string) => storage?.getItem(key) ?? null;
  const write = (key: string, value: Nullable<string>) => {
    if (!storage) return;
    if (value == null) storage.removeItem(key);
    else storage.setItem(key, value);
  };

  return {
    getAccessToken: () => read(STORAGE_KEYS.accessToken),
    setAccessToken: (token) => write(STORAGE_KEYS.accessToken, token),
    getRefreshToken: () => read(STORAGE_KEYS.refreshToken),
    setRefreshToken: (token) => write(STORAGE_KEYS.refreshToken, token),
    clear: () => {
      write(STORAGE_KEYS.accessToken, null);
      write(STORAGE_KEYS.refreshToken, null);
    },
  };
}

/**
 * Access token in memory, refresh token in Web Storage.
 *
 * This is the combination a body-based refresh flow wants. The access token is
 * short-lived and never touches disk, which keeps the XSS blast radius small;
 * the refresh token must outlive a page reload or the session cannot be
 * restored, and with no HTTP-only cookie available Web Storage is the only
 * place to put it. Swap to `createMemoryTokenStorage()` when the user has not
 * asked to be remembered.
 */
export function createHybridTokenStorage(
  storage: Storage | undefined = hasWindow ? window.localStorage : undefined,
): TokenStorage {
  const memory = createMemoryTokenStorage();

  const readRefresh = (): Nullable<string> => {
    try {
      return storage?.getItem(STORAGE_KEYS.refreshToken) ?? null;
    } catch {
      // Blocked storage degrades to a memory-only session.
      return null;
    }
  };

  const writeRefresh = (token: Nullable<string>): void => {
    try {
      if (!storage) return;
      if (token == null) storage.removeItem(STORAGE_KEYS.refreshToken);
      else storage.setItem(STORAGE_KEYS.refreshToken, token);
    } catch {
      // Non-fatal: the session simply will not survive a reload.
    }
  };

  return {
    getAccessToken: memory.getAccessToken,
    setAccessToken: memory.setAccessToken,
    getRefreshToken: readRefresh,
    setRefreshToken: writeRefresh,
    clear: () => {
      memory.clear();
      writeRefresh(null);
    },
  };
}

/**
 * The active token storage singleton. Defaults to memory storage; swap the
 * implementation here (or via `setTokenStorage`) when the backend auth contract
 * is finalized.
 */
let activeStorage: TokenStorage = createMemoryTokenStorage();

export function getTokenStorage(): TokenStorage {
  return activeStorage;
}

export function setTokenStorage(storage: TokenStorage): void {
  activeStorage = storage;
}
