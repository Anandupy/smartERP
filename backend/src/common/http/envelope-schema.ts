import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

/** Component name of the generic envelope registered by `applyResponseEnvelope`. */
export const ENVELOPE_SCHEMA = 'ResponseEnvelope';

/** Component name of the failure detail registered by `applyResponseEnvelope`. */
export const ERROR_SCHEMA = 'ErrorEnvelope';

/**
 * Marks a response schema that already describes the full envelope.
 *
 * `applyResponseEnvelope` wraps every 2xx schema it finds, so a schema built by
 * `ApiEnvelopeResponse` would otherwise be nested under a second `data`. The
 * marker lets the two mechanisms coexist: decorated handlers keep their precise
 * schema, undecorated ones still get wrapped.
 */
export const ENVELOPE_MARKER = 'x-enveloped';

export const ENVELOPE_REQUIRED = [
  'success',
  'message',
  'data',
  'meta',
  'error',
  'requestId',
  'timestamp',
] as const;

/** The fields every response carries, success or failure. */
export function envelopeProperties(message?: string): Record<string, unknown> {
  return {
    success: { type: 'boolean', example: true },
    message: {
      type: 'string',
      example: message ?? 'Operation completed successfully',
    },
    meta: { type: 'object', additionalProperties: true, example: {} },
    error: {
      allOf: [{ $ref: `#/components/schemas/${ERROR_SCHEMA}` }],
      nullable: true,
    },
    requestId: {
      type: 'string',
      example: '019fc2a1-0d7c-76cd-86ec-cbdf1628a566',
    },
    timestamp: { type: 'string', format: 'date-time' },
  };
}

export interface BuildEnvelopeSchemaOptions {
  /** Schema for `data`. Omit for an endpoint whose payload is always `null`. */
  data?: SchemaObject | Record<string, unknown>;
  /** Schema for `meta`. Omit for the default free-form object. */
  meta?: SchemaObject | Record<string, unknown>;
  /** Example value for `message`. */
  message?: string;
  /** Set the marker so `applyResponseEnvelope` leaves the schema alone. */
  marked?: boolean;
}

/** The `data: null` schema used by endpoints that return no payload. */
export const NULL_DATA_SCHEMA: Record<string, unknown> = {
  nullable: true,
  example: null,
  description: 'Always `null` — this endpoint returns no payload.',
};

/**
 * Builds the OpenAPI schema for `ResponseEnvelope<T>`.
 *
 * Single source of the envelope shape: both the per-handler decorators and the
 * document-wide transformer call this, so the two can never describe the
 * envelope differently.
 */
export function buildEnvelopeSchema({
  data,
  meta,
  message,
  marked = false,
}: BuildEnvelopeSchemaOptions = {}): Record<string, unknown> {
  const properties = envelopeProperties(message);

  if (meta) {
    properties.meta = meta;
  }

  return {
    type: 'object',
    properties: {
      ...properties,
      data: data ?? NULL_DATA_SCHEMA,
    },
    required: [...ENVELOPE_REQUIRED],
    ...(marked ? { [ENVELOPE_MARKER]: true } : {}),
  };
}
