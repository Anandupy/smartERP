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

/** What a handler's return value was interpreted as. */
interface NormalizedPayload {
  message: string;
  data: unknown;
  meta: Record<string, unknown>;
}

const DEFAULT_MESSAGE = 'Success';

/**
 * Wraps every successful response in the shared envelope.
 *
 * Controllers return `{ data, message, meta }` (any subset); anything else —
 * an entity, a list, a primitive — is treated as the payload itself.
 * `requestId` and `timestamp` are added here so that a success and a failure
 * can be correlated to server logs the same way; previously only errors
 * carried them.
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
      map((returned: unknown) => {
        // A handler that built the envelope itself gets it back untouched;
        // wrapping it again would bury the real payload under a second `data`.
        if (isResponseEnvelope(returned)) {
          return returned as ResponseEnvelope<T>;
        }

        const { message, data, meta } = normalize(returned);

        return {
          success: true,
          message,
          data: (data ?? null) as T | null,
          meta,
          error: null,
          requestId: request?.requestId ?? 'unknown',
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}

/**
 * Interprets a handler's return value as message, payload and metadata.
 *
 * Only a plain object can carry the `{ data, message, meta }` convention.
 * Arrays and primitives are payloads and nothing else — an array used to be
 * object-spread here, which turned a list of rows into `{"0": …, "1": …}`
 * while an empty list stayed an array, so one endpoint returned two different
 * types depending on how many rows it found.
 */
function normalize(returned: unknown): NormalizedPayload {
  if (!isPlainObject(returned)) {
    return { message: DEFAULT_MESSAGE, data: returned, meta: {} };
  }

  const envelope = returned;
  const message = envelope.message
    ? (envelope.message as string)
    : DEFAULT_MESSAGE;
  const meta = envelope.meta ? (envelope.meta as Record<string, unknown>) : {};

  if (envelope.data !== undefined) {
    return { message, data: envelope.data, meta };
  }

  // No explicit `data`: the object is the payload, minus the two envelope
  // keys. A handler that returned only `{ message }` has no payload at all.
  const { message: _message, meta: _meta, ...rest } = envelope;

  if (Object.keys(rest).length > 0) {
    return { message, data: rest, meta };
  }

  return {
    message,
    data: envelope.message || envelope.meta ? null : returned,
    meta,
  };
}

/** True for objects that can carry the `{ data, message, meta }` convention. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !Buffer.isBuffer(value)
  );
}

/** True when a handler already produced a complete envelope. */
function isResponseEnvelope(
  value: unknown,
): value is ResponseEnvelope<unknown> {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.success === 'boolean' &&
    typeof value.message === 'string' &&
    'data' in value &&
    'meta' in value &&
    'error' in value &&
    'requestId' in value &&
    'timestamp' in value
  );
}
