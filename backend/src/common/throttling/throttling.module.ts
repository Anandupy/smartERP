import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { buildThrottlerOptions } from './throttler.config';

/**
 * In-memory rate limiting for public endpoints.
 *
 * Uses the package's default storage — a Map in the process. There is no Redis
 * dependency, and the application works without one.
 */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: buildThrottlerOptions,
    }),
  ],
  exports: [ThrottlerModule],
})
export class ThrottlingModule {}
