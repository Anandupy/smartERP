import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { closeRootLogger } from './pino-root-logger';

/**
 * Closes the shared log streams on shutdown.
 *
 * A singleton, unlike `LoggerService` itself: the streams are process-wide, so
 * exactly one component must be responsible for closing them. Hooking shutdown
 * on the transient logger would run the teardown once per injected instance and
 * close files still being written by the others.
 *
 * Registered last in `LoggerModule` so it tears down after other providers have
 * had their chance to log during shutdown.
 */
@Injectable()
export class LoggerLifecycleService implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await closeRootLogger();
  }
}
