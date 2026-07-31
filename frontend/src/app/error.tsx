"use client";

import { useEffect } from "react";

import { Container } from "@/shared/components/layout";
import { ErrorState } from "@/shared/components/feedback";

/**
 * Route-level error boundary (Next.js `error.tsx`). Next 16 provides
 * `unstable_retry` to re-attempt rendering of the failed segment.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Replace with a telemetry sink (Sentry, etc.) when available.
    console.error(error);
  }, [error]);

  return (
    <Container
      size="sm"
      className="flex flex-1 items-center justify-center py-16"
    >
      <ErrorState
        error={error}
        onRetry={() => unstable_retry()}
        className="border-0"
      />
    </Container>
  );
}
