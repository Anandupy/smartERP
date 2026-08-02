import { OpenAPIObject } from '@nestjs/swagger';

const ENVELOPE_SCHEMA = 'ResponseEnvelope';
const ERROR_SCHEMA = 'ErrorEnvelope';

/** Envelope fields shared by success and failure responses. */
const envelopeProperties = (): Record<string, unknown> => ({
  success: { type: 'boolean', example: true },
  message: { type: 'string', example: 'Operation completed successfully' },
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
});

/**
 * Rewrites the generated OpenAPI document so responses match what the server
 * actually sends.
 *
 * `GlobalResponseInterceptor` wraps every controller return value, so a schema
 * generated from the handler's return type describes the payload, not the
 * response. Documenting that accurately per endpoint would mean a decorator on
 * roughly two hundred handlers — and one forgotten decorator silently
 * reintroduces the drift. Transforming the finished document keeps the
 * contract in one place and cannot be forgotten.
 *
 * Applied once in `main.ts`, after `SwaggerModule.createDocument`.
 */
export function applyResponseEnvelope(document: OpenAPIObject): OpenAPIObject {
  document.components ??= {};
  document.components.schemas ??= {};

  document.components.schemas[ERROR_SCHEMA] = {
    type: 'object',
    description: 'Populated only on failure.',
    properties: {
      code: {
        type: 'string',
        description: 'Stable machine-readable error code.',
        example: 'SETUP_REQUIRED',
      },
      details: {
        type: 'object',
        additionalProperties: true,
        nullable: true,
        description:
          'Structured, actionable detail carried by the error — for example the missing resources of a SETUP_REQUIRED.',
      },
    },
    required: ['code', 'details'],
  };

  document.components.schemas[ENVELOPE_SCHEMA] = {
    type: 'object',
    description:
      'The shared response shape. `data` is populated on success, `error` on failure.',
    properties: {
      ...envelopeProperties(),
      data: { nullable: true },
    },
    required: [
      'success',
      'message',
      'data',
      'meta',
      'error',
      'requestId',
      'timestamp',
    ],
  };

  for (const pathItem of Object.values(document.paths ?? {})) {
    for (const operation of Object.values(pathItem ?? {})) {
      const responses = (operation as { responses?: Record<string, unknown> })
        ?.responses;

      if (!responses) {
        continue;
      }

      for (const [statusCode, response] of Object.entries(responses)) {
        wrapResponse(statusCode, response);
      }
    }
  }

  return document;
}

function wrapResponse(statusCode: string, response: unknown): void {
  const content = (
    response as { content?: Record<string, { schema?: unknown }> }
  )?.content?.['application/json'];

  const isSuccess = statusCode.startsWith('2');

  if (!isSuccess) {
    // Failures never carry a payload, so the plain envelope describes them
    // fully. This also replaces Nest's default error schemas, which do not
    // match what GlobalExceptionFilter sends.
    if (content) {
      content.schema = { $ref: `#/components/schemas/${ENVELOPE_SCHEMA}` };
    }
    return;
  }

  if (!content?.schema) {
    return;
  }

  const payloadSchema = content.schema;

  content.schema = {
    type: 'object',
    properties: {
      ...envelopeProperties(),
      data: payloadSchema,
    },
    required: [
      'success',
      'message',
      'data',
      'meta',
      'error',
      'requestId',
      'timestamp',
    ],
  };
}
