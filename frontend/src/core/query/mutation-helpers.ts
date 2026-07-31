import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Reusable helpers for the common mutation lifecycle patterns. Feature modules
 * compose these into their `useMutation` calls to avoid re-implementing cache
 * invalidation boilerplate on every write.
 */

/** Invalidate one or more query-key roots after a successful mutation. */
export function invalidateKeys(client: QueryClient, keys: QueryKey[]) {
  return Promise.all(
    keys.map((queryKey) => client.invalidateQueries({ queryKey })),
  );
}

/**
 * Build optimistic-update handlers for `useMutation`. Snapshots the previous
 * value, applies `updater`, and restores on error — the canonical TanStack
 * optimistic pattern, made reusable and type-safe.
 */
export function optimisticUpdate<TData, TVariables>(
  client: QueryClient,
  queryKey: QueryKey,
  updater: (previous: TData | undefined, variables: TVariables) => TData,
) {
  return {
    onMutate: async (variables: TVariables) => {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData<TData>(queryKey);
      client.setQueryData<TData>(queryKey, (current) =>
        updater(current, variables),
      );
      return { previous };
    },
    onError: (
      _error: unknown,
      _variables: TVariables,
      context?: { previous?: TData },
    ) => {
      if (context?.previous !== undefined) {
        client.setQueryData<TData>(queryKey, context.previous);
      }
    },
    onSettled: () => client.invalidateQueries({ queryKey }),
  };
}
