import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthenticatedRequest } from '@/common/logger/request-context.middleware';
import { ResponseEnvelope } from '@/common/http/response-envelope';

/**
 * Wraps every successful response in the shared envelope.
 *
 * Controllers return `{ data, message, meta }` (any subset); anything else is
 * treated as the payload itself. `requestId` and `timestamp` are added here so
 * that a success and a failure can be correlated to server logs the same way —
 * previously only errors carried them.
 *
 * @see docs/core/response-contract.md
 */
@Injectable()
export class GlobalResponseInterceptor<T> implements NestInterceptor<
  T,
  ResponseEnvelope<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseEnvelope<T>> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    return next.handle().pipe(
      map((data) => {
        let message = 'Success';
        let responseData = data;
        let meta: Record<string, unknown> = {};

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
          data: responseData ?? null,
          meta,
          error: null,
          requestId: request?.requestId ?? 'unknown',
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
