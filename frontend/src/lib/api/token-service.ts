// ============================================================
// TokenService — Abstraction layer for token storage
//
// ARCHITECTURE NOTE:
// All token reads/writes MUST go through this service.
// Never access localStorage or Zustand directly for tokens.
//
// To migrate to HttpOnly cookies:
//   1. Update ONLY this file
//   2. Change the storage strategy in setRefreshToken/getRefreshToken
//   3. No other files change
// ============================================================

const ACCESS_TOKEN_KEY = '__eduos_at__';
const REFRESH_TOKEN_KEY = '__eduos_rt__';

/**
 * In-memory access token store.
 * Not persisted — lost on page refresh (intentional).
 * A silent refresh restores it using the refresh token.
 */
let inMemoryAccessToken: string | null = null;

export interface ITokenService {
  getAccessToken(): string | null;
  setAccessToken(token: string): void;
  clearAccessToken(): void;
  getRefreshToken(): string | null;
  setRefreshToken(token: string): void;
  clearRefreshToken(): void;
  clearAll(): void;
  hasRefreshToken(): boolean;
}

/**
 * Concrete token service.
 *
 * Access token  → in-memory variable (non-persistent)
 * Refresh token → localStorage (survives page refresh)
 *
 * Future: Swap localStorage for HttpOnly cookie strategy here.
 */
class TokenService implements ITokenService {
  getAccessToken(): string | null {
    return inMemoryAccessToken;
  }

  setAccessToken(token: string): void {
    inMemoryAccessToken = token;
  }

  clearAccessToken(): void {
    inMemoryAccessToken = null;
  }

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  setRefreshToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  }

  clearRefreshToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  clearAll(): void {
    this.clearAccessToken();
    this.clearRefreshToken();
    // Also clear any legacy key formats
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  }

  hasRefreshToken(): boolean {
    return !!this.getRefreshToken();
  }
}

/**
 * Singleton token service instance.
 * Import this everywhere tokens are needed.
 */
export const tokenService: ITokenService = new TokenService();
