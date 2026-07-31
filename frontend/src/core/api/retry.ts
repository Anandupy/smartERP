import type { AxiosError, InternalAxiosRequestConfig } from "axios";

import { apiConfig } from "@/config";

/**
 * Retry strategy placeholder.
 *
 * The decision logic lives here so the transport wiring is trivial to add once
 * the backend's idempotency and rate-limit semantics are finalized. Today the
 * client does not auto-retry (`apiConfig.retry.enabled === false`); this module
 * only decides *whether* a given failure would be retriable and how long to
 * wait, without performing any retry itself.
 */
export interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  __retryCount?: number;
}

export function shouldRetry(error: AxiosError): boolean {
  if (!apiConfig.retry.enabled) return false;

  const config = error.config as RetryableRequestConfig | undefined;
  if (!config) return false;

  const attempts = config.__retryCount ?? 0;
  if (attempts >= apiConfig.retry.maxRetries) return false;

  const method = config.method?.toLowerCase() ?? "get";
  const isRetriableMethod = (
    apiConfig.retry.retriableMethods as readonly string[]
  ).includes(method);
  if (!isRetriableMethod) return false;

  // Retry on network errors and 5xx / 429 responses only.
  const status = error.response?.status;
  if (status == null) return true;
  return status >= 500 || status === 429;
}

/** Exponential backoff with jitter. */
export function getRetryDelay(attempt: number): number {
  const exponential = apiConfig.retry.baseDelayMs * 2 ** attempt;
  const jitter = Math.random() * apiConfig.retry.baseDelayMs;
  return exponential + jitter;
}
