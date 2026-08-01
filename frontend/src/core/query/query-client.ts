import {
  MutationCache,
  QueryCache,
  QueryClient,
  type DefaultOptions,
} from "@tanstack/react-query";

import { ApiError } from "@/core/api";

/** Do not retry client errors (4xx); they will not succeed on repeat. */
function retryPolicy(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) {
    const nonRetriable: ApiError["kind"][] = [
      "unauthorized",
      "forbidden",
      "notFound",
      "validation",
      "conflict",
      "canceled",
    ];
    if (nonRetriable.includes(error.kind)) return false;
  }
  return failureCount < 2;
}

const defaultOptions: DefaultOptions = {
  queries: {
    retry: retryPolicy,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },
  mutations: {
    retry: false,
  },
};

export interface QueryClientHandlers {
  /** Invoked for every query error that has an active observer. */
  onQueryError?: (error: unknown) => void;
  /**
   * Invoked for every mutation error, with the mutation's `meta` so the
   * consumer can opt out of global reporting — a form that renders the failure
   * inline should not also raise a toast for it.
   */
  onMutationError?: (error: unknown, meta?: Record<string, unknown>) => void;
}

/**
 * Build a `QueryClient` with platform defaults. Error handlers are injected by
 * the provider (which owns the toast dependency) so this module stays UI-free.
 */
export function createQueryClient(
  handlers: QueryClientHandlers = {},
): QueryClient {
  return new QueryClient({
    defaultOptions,
    queryCache: new QueryCache({
      onError: (error) => handlers.onQueryError?.(error),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) =>
        handlers.onMutationError?.(error, mutation.meta),
    }),
  });
}
