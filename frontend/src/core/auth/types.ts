import type { ID } from "@/types/common";

/**
 * Auth domain contracts. The backend auth API is not finalized, so these are
 * intentionally interface-only: they define the shape the rest of the app codes
 * against, and the concrete login/refresh implementation slots in later without
 * touching consumers.
 */

export interface AuthUser {
  id: ID;
  name: string;
  email: string;
  roles: string[];
  /** Flat permission strings, e.g. "students:read". */
  permissions: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken?: string;
  /** Unix epoch (ms) when the access token expires, if known. */
  expiresAt?: number;
}

export type AuthStatus =
  "idle" | "authenticating" | "authenticated" | "unauthenticated";

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
}

export interface AuthContextValue extends AuthState {
  readonly isAuthenticated: boolean;
  /**
   * Persist a session. Implemented by the auth feature once the backend is
   * ready; the platform only guarantees the signature.
   */
  setSession: (user: AuthUser, tokens: TokenPair) => void;
  /** Clear the session (logout). */
  clearSession: () => void;
}

/** Cross-cutting session context: the active tenant/branch/workspace scope. */
export interface SessionContextValue {
  tenantId: string | null;
  branchId: string | null;
  academicYearId: string | null;
  workspaceId: string | null;
  setScope: (scope: Partial<SessionScope>) => void;
}

export interface SessionScope {
  tenantId: string | null;
  branchId: string | null;
  academicYearId: string | null;
  workspaceId: string | null;
}

export interface PermissionContextValue {
  permissions: readonly string[];
  roles: readonly string[];
  can: (permission: string) => boolean;
  canAny: (permissions: string[]) => boolean;
  canAll: (permissions: string[]) => boolean;
  hasRole: (role: string) => boolean;
}
