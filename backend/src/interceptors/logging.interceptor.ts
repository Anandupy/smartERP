import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { LoggerService } from '@/infrastructure/logger/logger.service';
import { AuthenticatedRequest } from '@/middleware/request-context.middleware';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<AuthenticatedRequest>();
    const res = ctx.getResponse();
    
    const { method, url, context: reqContext } = req;
    const startTime = Date.now();

    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      this.logger.logRequest({
        requestId: reqContext?.requestId || 'unknown',
        method,
        url,
        statusCode: res.statusCode,
        responseTime,
        userId: reqContext?.userId || null,
        branchId: reqContext?.branchId || null,
      });
    });

    return next.handle();
  }
}
