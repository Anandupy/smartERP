import { Injectable, Logger } from '@nestjs/common';
import { RetryOptions, RetryStrategy } from './retry-strategy.interface';

@Injectable()
export class ExponentialBackoffRetryStrategy implements RetryStrategy {
  private readonly logger = new Logger(ExponentialBackoffRetryStrategy.name);

  private readonly defaultOptions: RetryOptions = {
    maxRetries: 3,
    initialDelayMs: 100,
    maxDelayMs: 5000,
    backoffFactor: 2,
  };

  async execute<T>(
    operation: () => Promise<T>,
    options?: Partial<RetryOptions>,
  ): Promise<T> {
    const config = { ...this.defaultOptions, ...options };
    let lastError: any;

    for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt > config.maxRetries) break;

        const delay = this.calculateDelay(attempt, config);
        this.logger.warn(
          `Operation attempt ${attempt} failed: ${error instanceof Error ? error.message : String(error)}. Retrying in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  calculateDelay(attempt: number, options: RetryOptions): number {
    const delay = options.initialDelayMs * Math.pow(options.backoffFactor, attempt - 1);
    return Math.min(delay, options.maxDelayMs);
  }
}
