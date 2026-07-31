"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Returns `true` once mounted on the client, `false` during SSR and the initial
 * hydration snapshot. Uses `useSyncExternalStore` so server/client snapshots are
 * explicit and there is no effect-driven cascading render.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
