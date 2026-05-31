'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: (props: { error: Error; reset: () => void }) => React.ReactNode;
  className?: string;
}

/**
 * Module-level error boundary.
 * Catches errors in child components and renders a fallback UI.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <AdmissionsModule />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          reset: this.reset,
        });
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          reset={this.reset}
          className={this.props.className}
        />
      );
    }

    return this.props.children;
  }
}

// ── Default Fallback ──────────────────────────────────────────

interface DefaultErrorFallbackProps {
  error: Error;
  reset: () => void;
  className?: string;
}

function DefaultErrorFallback({ error, reset, className }: DefaultErrorFallbackProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-lg border border-erp bg-surface p-8 text-center',
        className,
      )}
      role="alert"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive-bg">
        <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden />
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">
          Something went wrong
        </h3>
        <p className="text-xs text-muted-erp max-w-xs">
          {error.message || 'An unexpected error occurred in this section.'}
        </p>
      </div>

      <button
        onClick={reset}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium',
          'bg-surface-2 text-foreground hover:bg-border-strong',
          'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        Try again
      </button>
    </div>
  );
}
