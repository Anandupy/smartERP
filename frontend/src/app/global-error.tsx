"use client";

import { useEffect } from "react";

/**
 * Root-level error boundary. Replaces the root layout when the layout itself
 * throws, so it must render its own <html>/<body> and cannot rely on global
 * styles or providers. Kept deliberately minimal and self-contained.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: "system-ui, sans-serif",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
          Something went wrong
        </h1>
        <p style={{ maxWidth: "24rem", color: "#666" }}>
          An unexpected error occurred. Please try again.
        </p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          style={{
            borderRadius: "0.5rem",
            border: "1px solid #ccc",
            padding: "0.5rem 1rem",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
