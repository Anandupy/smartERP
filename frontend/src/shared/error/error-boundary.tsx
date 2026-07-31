"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { ErrorState } from "@/shared/components/feedback";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback; receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Side-effect hook for logging/telemetry. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Reusable React error boundary for component subtrees that are not tied to a
 * route segment (Next.js `error.tsx` covers route-level errors). Use this to
 * isolate widgets so one failing panel doesn't take down the page.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) {
        return this.props.fallback(error, this.reset);
      }
      return <ErrorState error={error} onRetry={this.reset} />;
    }
    return this.props.children;
  }
}
