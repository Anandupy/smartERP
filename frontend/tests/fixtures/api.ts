import type { ApiErrorResponse, ApiMeta, ApiResponse } from "@/types/api";

/**
 * Builders for the backend response envelopes, shared across tests and MSW
 * handlers so fixtures stay consistent with the real wire format.
 */

export function successEnvelope<T>(
  data: T,
  options?: { message?: string | null; meta?: ApiMeta | null },
): ApiResponse<T> {
  return {
    success: true,
    message: options?.message ?? null,
    data,
    meta: options?.meta ?? null,
    error: null,
  };
}

export function errorEnvelope(
  overrides: Partial<ApiErrorResponse> &
    Pick<ApiErrorResponse, "code" | "message">,
): ApiErrorResponse {
  return {
    success: false,
    requestId: "req-test-0001",
    timestamp: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** A representative domain entity used by the example feature template. */
export const exampleEntity = {
  id: "1",
  name: "Example",
  createdAt: "2026-01-01T00:00:00.000Z",
};
