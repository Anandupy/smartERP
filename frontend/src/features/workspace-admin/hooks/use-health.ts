"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { healthKeys } from "../api/health.keys";
import { healthService } from "../api/health.service";
import { HEALTH_POLL_INTERVAL_MS } from "../constants";

/**
 * The shared shape for all three probe hooks below.
 *
 * `queryFn` never throws (`healthService` catches everything into a
 * `ProbeResult`), so `query.data` is always present once the first attempt
 * settles and `query.error` is never used — a failed probe is data, not an
 * exception, which is what lets the three cards render independently.
 *
 * Polled at {@link HEALTH_POLL_INTERVAL_MS} (30s, the conservative interval the
 * design brief asks for) via TanStack Query's own `refetchInterval`, not a
 * hand-rolled `setInterval`.
 */
const PROBE_OPTIONS = {
  refetchInterval: HEALTH_POLL_INTERVAL_MS,
  refetchOnWindowFocus: false,
  retry: false,
} as const;

export function useLiveness() {
  return useQuery({
    queryKey: healthKeys.live(),
    queryFn: healthService.getLive,
    ...PROBE_OPTIONS,
  });
}

export function useReadiness() {
  return useQuery({
    queryKey: healthKeys.ready(),
    queryFn: healthService.getReady,
    ...PROBE_OPTIONS,
  });
}

export function useFullHealth() {
  return useQuery({
    queryKey: healthKeys.full(),
    queryFn: healthService.getFull,
    ...PROBE_OPTIONS,
  });
}

/**
 * Refetch all three probes at once — the Health Monitor's manual "Refresh".
 *
 * Deliberately not `Promise.all` on the three query functions directly: going
 * through `queryClient.invalidateQueries` keeps each card's own `isFetching`
 * state correct independently.
 */
export function useRefreshHealth() {
  const queryClient = useQueryClient();

  return () =>
    Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: healthKeys.live() }),
      queryClient.invalidateQueries({ queryKey: healthKeys.ready() }),
      queryClient.invalidateQueries({ queryKey: healthKeys.full() }),
    ]);
}
