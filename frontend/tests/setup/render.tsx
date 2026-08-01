import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";

/** A QueryClient tuned for deterministic tests (no retries, no caching). */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function AllProviders({ children }: { children: ReactNode }) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}

/**
 * Custom render that wraps the UI in the platform's client providers. Use this
 * instead of Testing Library's raw `render` for components that need context.
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export * from "@testing-library/react";
export { renderWithProviders as render };
