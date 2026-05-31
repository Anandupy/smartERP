'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[Global Error]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center bg-surface">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive-bg">
        <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
        <p className="text-sm text-muted-erp max-w-sm">
          An unexpected error occurred. Please try again or contact your system administrator if the problem persists.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-muted-erp">
            Error ID: {error.digest}
          </p>
        )}
      </div>
      <button
        onClick={reset}
        className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        Try again
      </button>
    </div>
  );
}
