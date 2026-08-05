import { ApiProperty } from '@nestjs/swagger';

/**
 * The single response shape for every endpoint.
 *
 * Success and failure share these fields so a client can read `success`,
 * `message`, `requestId` and `timestamp` without first branching on the status
 * code. `data` carries the payload on success; `error` carries the machine
 * readable code and structured details on failure. Exactly one of them is
 * populated.
 */
export interface ResponseEnvelope<T> {
  success: boolean;
  message: string;
  data: T | null;
  meta: Record<string, unknown>;
  error: ErrorEnvelope | null;
  requestId: string;
  timestamp: string;
}

export interface ErrorEnvelope {
  /** Stable machine-readable code, e.g. `SETUP_REQUIRED`, `P2002_UNIQUE`. */
  code: string;
  /**
   * Structured, actionable detail carried by the exception — the missing
   * resources of a SETUP_REQUIRED, the choices of a CONTEXT_SELECTION_REQUIRED.
   * Null when the exception carried nothing beyond a message.
   */
  details: Record<string, unknown> | null;
}

// --- Swagger models -------------------------------------------------------
//
// Declared as classes because OpenAPI schema generation is driven by decorator
// metadata, which interfaces do not carry.

export class ErrorEnvelopeDto implements ErrorEnvelope {
  @ApiProperty({
    description: 'Stable machine-readable error code.',
    example: 'SETUP_REQUIRED',
  })
  code!: string;

  @ApiProperty({
    description: 'Structured detail carried by the error, when it has any.',
    nullable: true,
    type: 'object',
    additionalProperties: true,
    example: { setupStage: 'ORGANIZATION', missingResources: ['ORGANIZATION'] },
  })
  details!: Record<string, unknown> | null;
}

/**
 * Envelope-level pagination metadata.
 *
 * Used by endpoints whose service returns `{ data, meta }` and whose controller
 * returns that object unchanged — `GlobalResponseInterceptor` then lifts `meta`
 * onto the envelope. Endpoints that nest `{ items, meta }` under `data` are
 * documented with `PaginatedPayloadDto` instead, because that is where the
 * pagination actually lands at runtime.
 */
export class PaginationMetaDto {
  @ApiProperty({ description: 'Total matching records.', example: 137 })
  total!: number;

  @ApiProperty({ description: 'Current page, 1-based.', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Records per page.', example: 50 })
  limit!: number;

  @ApiProperty({ description: 'Total number of pages.', example: 3 })
  totalPages!: number;
}

export class ResponseEnvelopeDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Operation completed successfully' })
  message!: string;

  @ApiProperty({
    description: 'The payload. Null on failure.',
    nullable: true,
  })
  data!: unknown;

  @ApiProperty({
    description: 'Pagination and other envelope-level metadata.',
    type: 'object',
    additionalProperties: true,
    example: {},
  })
  meta!: Record<string, unknown>;

  @ApiProperty({
    description: 'Populated only on failure.',
    nullable: true,
    type: ErrorEnvelopeDto,
  })
  error!: ErrorEnvelopeDto | null;

  @ApiProperty({
    description: 'Correlates the response with server logs.',
    example: '019fc2a1-0d7c-76cd-86ec-cbdf1628a566',
  })
  requestId!: string;

  @ApiProperty({ example: '2026-08-02T12:34:56.789Z' })
  timestamp!: string;
}
