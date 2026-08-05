import { OpenAPIObject } from '@nestjs/swagger';
import {
  ENVELOPE_MARKER,
  ENVELOPE_REQUIRED,
  ENVELOPE_SCHEMA,
  ERROR_SCHEMA,
  buildEnvelopeSchema,
  envelopeProperties,
} from './envelope-schema';

/**
 * Rewrites the generated OpenAPI document so responses match what the server
 * actually sends.
 *
 * `GlobalResponseInterceptor` wraps every controller return value, so a schema
 * generated from the handler's return type describes the payload, not the
 * response.
 *
 * Handlers documented with `ApiEnvelopeResponse` already carry the full
 * envelope and are marked as such; this pass skips them and wraps everything
 * else. Keeping the transformer means an endpoint that nobody remembered to
 * decorate still shows the right outer shape instead of silently drifting.
 *
 * Applied once in `main.ts`, after `SwaggerModule.createDocument`.
 *
 * @see docs/core/response-contract.md
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
    required: [...ENVELOPE_REQUIRED],
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

  if (isEnveloped(content.schema)) {
    // Declared by ApiEnvelopeResponse, which already nested the payload under
    // `data`. Wrapping it again would bury the DTO one level too deep.
    return;
  }

  content.schema = buildEnvelopeSchema({
    data: content.schema as Record<string, unknown>,
  });
}

function isEnveloped(schema: unknown): boolean {
  return (schema as Record<string, unknown>)?.[ENVELOPE_MARKER] === true;
}
