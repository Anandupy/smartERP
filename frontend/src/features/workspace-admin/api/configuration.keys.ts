import type { WorkspaceScopeType } from "../types/configuration.dto";

/**
 * Query keys for `/workspace/configuration`.
 *
 * `detail` keys a single layer by its exact `(scopeType, scopeId)` — the same
 * pair `GET /workspace/configuration/:scopeType?scopeId=` reads by. `all` is
 * kept as the mutation identity `useUpsertConfiguration` already used before
 * the GET existed, and as the broad prefix nothing narrower needs.
 */
export const configurationKeys = {
  all: ["workspace-admin-configuration"] as const,
  detail: (scopeType: WorkspaceScopeType, scopeId: string | null) =>
    [...configurationKeys.all, scopeType, scopeId ?? "PRODUCT"] as const,
} as const;
