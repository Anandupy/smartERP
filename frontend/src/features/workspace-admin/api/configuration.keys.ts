/**
 * Query keys for `/workspace/configuration`.
 *
 * There is no `GET`/list endpoint (verified against
 * `workspace-config.service.ts` and the controller — the only method is
 * `upsertConfiguration`), so this holds a mutation identity only, for
 * `useMutation`'s `mutationKey` and any future cache the module adds.
 */
export const configurationKeys = {
  all: ["workspace-admin-configuration"] as const,
} as const;
