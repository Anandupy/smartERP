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

/**
 * The failure envelope as the backend sends it today
 * (`backend/docs/core/response-contract.md`): the code and any structured
 * detail sit in `error`, not at the top level.
 */
export function failureEnvelope(options: {
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
}): ApiErrorResponse {
  return {
    success: false,
    message: options.message,
    error: { code: options.code, details: options.details ?? null },
    requestId: "req-test-0001",
    timestamp: "2026-01-01T00:00:00.000Z",
  };
}

/** The older failure shape, with `code` at the top level. */
export function errorEnvelope(
  overrides: Partial<ApiErrorResponse> &
    Required<Pick<ApiErrorResponse, "code" | "message">>,
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
