/**
 * Type-safe query-key factory helpers.
 *
 * Every feature owns its own key namespace but builds it with `createQueryKeys`
 * so keys stay consistent, serializable, and easy to invalidate. Example:
 *
 * ```ts
 * export const studentKeys = createQueryKeys("students");
 * studentKeys.list({ page: 1 }); // ["students", "list", { page: 1 }]
 * studentKeys.detail(id);        // ["students", "detail", id]
 * ```
 */
export type QueryKeyPart = string | number | boolean | null | undefined;
/** Serializable filter bag used as the trailing part of a list key. */
export type QueryKeyRecord = object;

export interface FeatureQueryKeys {
  readonly all: readonly [string];
  lists: () => readonly [string, "list"];
  list: (filters?: QueryKeyRecord) => readonly unknown[];
  details: () => readonly [string, "detail"];
  detail: (id: QueryKeyPart) => readonly unknown[];
}

export function createQueryKeys(namespace: string): FeatureQueryKeys {
  const all = [namespace] as const;
  return {
    all,
    lists: () => [namespace, "list"] as const,
    list: (filters?: QueryKeyRecord) =>
      filters
        ? ([namespace, "list", filters] as const)
        : ([namespace, "list"] as const),
    details: () => [namespace, "detail"] as const,
    detail: (id: QueryKeyPart) => [namespace, "detail", id] as const,
  };
}
