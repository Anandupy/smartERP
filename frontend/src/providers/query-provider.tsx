"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";
import { toast } from "sonner";

import { isDevelopment } from "@/config";
import { ApiError } from "@/core/api";
import { createQueryClient } from "@/core/query";
import { getErrorMessage } from "@/lib";

/**
 * Wires TanStack Query into the app. Owns the toast dependency so the core
 * query layer stays UI-agnostic: cache errors are surfaced here as toasts,
 * except benign cancellations.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() =>
    createQueryClient({
      onQueryError: notify,
      onMutationError: notify,
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {isDevelopment ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
}

function notify(error: unknown): void {
  if (error instanceof ApiError && error.kind === "canceled") return;
  toast.error(getErrorMessage(error));
}
