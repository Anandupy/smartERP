import { HttpStatus, Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import {
  ENVELOPE_SCHEMA,
  NULL_DATA_SCHEMA,
  buildEnvelopeSchema,
} from './envelope-schema';
import { PaginationMetaDto } from './response-envelope';

/** A DTO class, a primitive name, or a hand-written schema. */
export type EnvelopeDataType =
  | Type<unknown>
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | SchemaObject;

export interface EnvelopeResponseOptions {
  /** HTTP status the schema documents. Defaults to 200. */
  status?: HttpStatus | number;
  /** Description shown next to the status code. */
  description?: string;
  /** Example value for the envelope's `message`. */
  message?: string;
  /** Document `data` as an array of the given type. */
  isArray?: boolean;
  /**
   * The endpoint can legitimately return `null` — a lookup that finds nothing
   * and answers 200 rather than 404.
   */
  nullable?: boolean;
  /**
   * Type of the envelope-level `meta`. Pass `PaginationMetaDto` for endpoints
   * that return `{ data, meta }` straight from the service.
   */
  meta?: Type<unknown> | SchemaObject;
}

function isClass(type: EnvelopeDataType): type is Type<unknown> {
  return typeof type === 'function';
}

function dataSchema(
  type: EnvelopeDataType | undefined,
  isArray: boolean,
  nullable: boolean,
): Record<string, unknown> {
  if (!type) {
    return NULL_DATA_SCHEMA;
  }

  const base: Record<string, unknown> = isClass(type)
    ? { $ref: getSchemaPath(type) }
    : typeof type === 'string'
      ? { type }
      : (type as Record<string, unknown>);

  const schema = isArray ? { type: 'array', items: base } : base;

  if (!nullable) {
    return schema;
  }

  // OpenAPI 3.0 cannot put `nullable` beside a `$ref` — sibling keys of a
  // `$ref` are ignored — so the reference is wrapped in an `allOf`.
  return schema.$ref
    ? { allOf: [schema], nullable: true }
    : { ...schema, nullable: true };
}

function extraModels(
  ...types: (EnvelopeDataType | undefined)[]
): Type<unknown>[] {
  return types.filter((type): type is Type<unknown> => !!type && isClass(type));
}

/**
 * Documents a handler's response as `ResponseEnvelope<T>`.
 *
 * Handlers return the payload; `GlobalResponseInterceptor` wraps it. Declaring
 * the payload type alone therefore documents a shape no client ever receives.
 * This decorator emits the whole envelope with the DTO nested under `data`, and
 * marks the schema so `applyResponseEnvelope` — which wraps every *undecorated*
 * 2xx response — leaves it alone.
 *
 * @example
 * ```typescript
 * @ApiEnvelopeResponse(ProgramDto, { status: 201, message: 'Program created' })
 * ```
 */
export function ApiEnvelopeResponse(
  type?: EnvelopeDataType,
  options: EnvelopeResponseOptions = {},
): MethodDecorator & ClassDecorator {
  const {
    status = HttpStatus.OK,
    description,
    message,
    isArray = false,
    nullable = false,
    meta,
  } = options;

  const metaSchema = meta
    ? isClass(meta)
      ? { $ref: getSchemaPath(meta) }
      : (meta as Record<string, unknown>)
    : undefined;

  return applyDecorators(
    ApiExtraModels(...extraModels(type, meta)),
    ApiResponse({
      status,
      description: description ?? message ?? 'Success',
      schema: buildEnvelopeSchema({
        data: type ? dataSchema(type, isArray, nullable) : undefined,
        meta: metaSchema,
        message,
        marked: true,
      }),
    }),
  );
}

/** `200 OK` carrying `ResponseEnvelope<T>`. */
export function ApiOkEnvelope(
  type: EnvelopeDataType,
  options: Omit<EnvelopeResponseOptions, 'status'> = {},
) {
  return ApiEnvelopeResponse(type, { ...options, status: HttpStatus.OK });
}

/** `201 Created` carrying `ResponseEnvelope<T>`. */
export function ApiCreatedEnvelope(
  type: EnvelopeDataType,
  options: Omit<EnvelopeResponseOptions, 'status'> = {},
) {
  return ApiEnvelopeResponse(type, { ...options, status: HttpStatus.CREATED });
}

/**
 * A response whose `data` is always `null` — logout, delete, acknowledge.
 *
 * Documents `data: null` rather than leaving Swagger to guess `unknown`.
 */
export function ApiEmptyEnvelope(
  options: EnvelopeResponseOptions = {},
): MethodDecorator & ClassDecorator {
  return ApiEnvelopeResponse(undefined, {
    status: HttpStatus.OK,
    ...options,
  });
}

/**
 * A list whose pagination lands on the envelope's `meta`.
 *
 * For services that return `{ data, meta }` from a controller that forwards the
 * object unchanged: the interceptor lifts `meta` out, so `data` is the bare
 * array.
 */
export function ApiPaginatedEnvelope(
  type: EnvelopeDataType,
  options: Omit<EnvelopeResponseOptions, 'isArray' | 'meta'> & {
    meta?: Type<unknown> | SchemaObject;
  } = {},
) {
  return ApiEnvelopeResponse(type, {
    status: HttpStatus.OK,
    ...options,
    isArray: true,
    meta: options.meta ?? PaginationMetaDto,
  });
}

/**
 * A list whose pagination is nested inside `data` as `{ items, meta }`.
 *
 * The controller wraps the service result in `{ data: result }`, so the
 * pagination never reaches the envelope's `meta`. Documented where it actually
 * is rather than where the convention would put it.
 */
export function ApiPaginatedItemsEnvelope(
  type: Type<unknown>,
  options: Omit<EnvelopeResponseOptions, 'isArray'> = {},
) {
  return applyDecorators(
    ApiExtraModels(type, PaginationMetaDto),
    ApiEnvelopeResponse(
      {
        type: 'object',
        properties: {
          items: { type: 'array', items: { $ref: getSchemaPath(type) } },
          meta: { $ref: getSchemaPath(PaginationMetaDto) },
        },
        required: ['items', 'meta'],
      },
      { status: HttpStatus.OK, ...options },
    ),
  );
}

/**
 * A list whose pagination is nested inside `data` as `{ data, meta }`.
 *
 * Same as {@link ApiPaginatedItemsEnvelope} but for services that name the page
 * `data` instead of `items`.
 */
export function ApiPaginatedDataEnvelope(
  type: Type<unknown>,
  options: Omit<EnvelopeResponseOptions, 'isArray'> & {
    meta?: Type<unknown>;
  } = {},
) {
  const metaType = options.meta ?? PaginationMetaDto;

  return applyDecorators(
    ApiExtraModels(type, metaType),
    ApiEnvelopeResponse(
      {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(type) } },
          meta: { $ref: getSchemaPath(metaType) },
        },
        required: ['data', 'meta'],
      },
      { status: HttpStatus.OK, ...options, meta: undefined },
    ),
  );
}

/** Human-readable reason for each documented failure status. */
const ERROR_DESCRIPTIONS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Validation failed or the request is malformed.',
  [HttpStatus.UNAUTHORIZED]: 'Missing, expired or invalid credentials.',
  [HttpStatus.FORBIDDEN]:
    'Authenticated but not permitted — role, permission or execution context.',
  [HttpStatus.NOT_FOUND]: 'The requested resource does not exist.',
  [HttpStatus.CONFLICT]:
    'The request conflicts with current state — duplicate or unmet precondition.',
  [HttpStatus.UNPROCESSABLE_ENTITY]:
    'The request was understood but cannot be processed.',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Rate limit exceeded.',
  [HttpStatus.SERVICE_UNAVAILABLE]:
    'The service is unavailable — maintenance window or failed dependency.',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Unexpected server error.',
};

/**
 * Documents failure responses with the shared envelope.
 *
 * `GlobalExceptionFilter` sends the same envelope for every failure, with the
 * machine-readable code under `error.code`, so one schema describes them all.
 * Without this, Nest emits its own default error schemas, which do not match
 * what the filter sends.
 *
 * @param statuses Additional statuses beyond the always-documented 400, 401,
 * 403 and 500.
 */
export function ApiStandardErrors(
  ...statuses: (HttpStatus | number)[]
): MethodDecorator & ClassDecorator {
  const all = new Set<number>([
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.INTERNAL_SERVER_ERROR,
    ...statuses,
  ]);

  return applyDecorators(
    ...[...all]
      .sort((a, b) => a - b)
      .map((status) =>
        ApiResponse({
          status,
          description: ERROR_DESCRIPTIONS[status] ?? 'Request failed.',
          schema: { $ref: `#/components/schemas/${ENVELOPE_SCHEMA}` },
        }),
      ),
  );
}

/**
 * Failure responses for a public endpoint — no 401/403 to document.
 */
export function ApiPublicErrors(
  ...statuses: (HttpStatus | number)[]
): MethodDecorator & ClassDecorator {
  const all = new Set<number>([
    HttpStatus.BAD_REQUEST,
    HttpStatus.INTERNAL_SERVER_ERROR,
    ...statuses,
  ]);

  return applyDecorators(
    ...[...all]
      .sort((a, b) => a - b)
      .map((status) =>
        ApiResponse({
          status,
          description: ERROR_DESCRIPTIONS[status] ?? 'Request failed.',
          schema: { $ref: `#/components/schemas/${ENVELOPE_SCHEMA}` },
        }),
      ),
  );
}
