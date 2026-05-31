import { QueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@/types/api.types';

/**
 * Singleton query client factory.
 * Created once per browser session.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 5 minutes — reasonable for ERP data that changes infrequently
        staleTime: 5 * 60 * 1000,
        // 30 minutes — keep data in cache for fast back-navigation
        gcTime: 30 * 60 * 1000,
        // Don't refetch on window focus — ERP users work in a single tab
        refetchOnWindowFocus: false,
        // Retry logic — don't retry on 404/403
        retry: (failureCount, error) => {
          if (error instanceof ApiClientError) {
            if (error.status === 404) return false;
            if (error.status === 403) return false;
            if (error.status === 401) return false;
          }
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      },
      mutations: {
        // Don't retry mutations by default
        retry: false,
      },
    },
  });
}
