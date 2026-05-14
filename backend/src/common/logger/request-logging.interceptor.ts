import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { LoggerService, RequestLogData } from './logger.service';
import { AuthenticatedRequest } from './request-context.middleware';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { method, url, ip, user, context: reqContext } = request;
    const requestId = request.requestId;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const responseTime = Date.now() - startTime;

        const logData: RequestLogData = {
          requestId,
          method,
          url,
          ip,
          statusCode: response.statusCode as number,
          responseTime,
          userId: user?.id || user?.sub,
          role: user?.role,
          organizationId: user?.organizationId || reqContext?.organizationId,
          branchId: user?.branchId || reqContext?.branchId,
        };

        this.logger.logRequest(logData);
      }),
      catchError((error: any) => {
        const responseTime = Date.now() - startTime;
        const statusCode = (error.status as number) || 500;

        const logData: RequestLogData = {
          requestId,
          method,
          url,
          ip,
          statusCode,
          responseTime,
          userId: user?.id || user?.sub,
          role: user?.role,
          organizationId: user?.organizationId || reqContext?.organizationId,
          branchId: user?.branchId || reqContext?.branchId,
          errorMessage: (error.message as string) || 'Unknown error',
        };

        this.logger.logRequest(logData);
        return throwError(() => error);
      }),
    );
  }
}
