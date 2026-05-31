'use client';

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createQueryClient } from '@/config/query-client';
import { env } from '@/config/env';

interface QueryProviderProps {
  children: React.ReactNode;
}

/**
 * TanStack Query provider.
 * Creates a stable QueryClient instance per browser session.
 * Devtools are only shown in development.
 */
export function QueryProvider({ children }: QueryProviderProps) {
  // useState ensures the QueryClient is not recreated on re-renders
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {env.enableDevtools && (
        <ReactQueryDevtools initialIsOpen={false} position="bottom" />
      )}
    </QueryClientProvider>
  );
}
