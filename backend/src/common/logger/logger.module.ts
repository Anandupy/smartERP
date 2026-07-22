import { Module, Global } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { RequestContextService } from './request-context.service';

@Global()
@Module({
  providers: [LoggerService, RequestContextService],
  exports: [LoggerService, RequestContextService],
})
export class LoggerModule {}
