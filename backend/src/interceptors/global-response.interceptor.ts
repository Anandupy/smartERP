import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthenticatedRequest } from '@/middleware/request-context.middleware';

export interface Response<T> {
  success: boolean;
  message: string;
  traceId: string;
  data: T;
  meta?: any;
}

@Injectable()
export class GlobalResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<AuthenticatedRequest>();
    const traceId = req.context?.requestId || 'unknown';

    return next.handle().pipe(
      map((data) => {
        let message = 'Success';
        let responseData = data;
        let meta = undefined;

        if (data && typeof data === 'object') {
          if (data.message) {
            message = data.message;
          }
          if (data.meta) {
            meta = data.meta;
          }
          if (data.data !== undefined) {
            responseData = data.data;
          } else {
            // Keep the object as data if no explicit 'data' property, but without message/meta
            const { message: _m, meta: _meta, ...rest } = data;
            if (Object.keys(rest).length > 0) {
              responseData = rest;
            } else if (data.message || data.meta) {
              responseData = null;
            }
          }
        }

        return {
          success: true,
          message,
          traceId,
          data: responseData ?? null,
          ...(meta !== undefined && { meta }),
        };
      }),
    );
  }
}
