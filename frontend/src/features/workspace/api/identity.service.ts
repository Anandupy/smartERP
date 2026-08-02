import { api } from "@/core/api";

import type { IdentityDto } from "../types/identity.dto";

/**
 * Transport for the identity endpoint. One function, no state, no domain rules.
 *
 * The path is version-agnostic — the client resolves `/auth/me` against the
 * configured `<origin>/v1` base, so moving to v2 stays an environment change.
 */
export const identityService = {
  /**
   * `GET /auth/me` → the signed-in user, their effective permissions, and every
   * scope they may operate in. Authenticated: the `Authorization` header is
   * supplied by the auth feature's header provider.
   */
  me: () => api.get<IdentityDto>("/auth/me"),
} as const;
