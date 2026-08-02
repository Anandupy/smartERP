import { Module, Global } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { RequestContextService } from './request-context.service';
import { LoggerLifecycleService } from './logger-lifecycle.service';

@Global()
@Module({
  providers: [LoggerService, RequestContextService, LoggerLifecycleService],
  exports: [LoggerService, RequestContextService],
})
export class LoggerModule {}
