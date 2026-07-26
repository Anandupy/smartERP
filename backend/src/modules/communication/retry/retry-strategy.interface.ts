export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
}

export abstract class RetryStrategy {
  abstract execute<T>(
    operation: () => Promise<T>,
    options?: Partial<RetryOptions>,
  ): Promise<T>;
  abstract calculateDelay(attempt: number, options: RetryOptions): number;
}
