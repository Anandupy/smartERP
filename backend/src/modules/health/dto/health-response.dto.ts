import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** The liveness answer: the process is up, and for how long. */
export class LivenessDto {
  @ApiProperty({ enum: ['ok'], example: 'ok' })
  status!: string;

  @ApiProperty({ description: 'Process uptime in seconds.', example: 86400 })
  uptimeSeconds!: number;
}

/**
 * A Terminus health report.
 *
 * `details` holds every indicator; `info` and `error` are the passing and
 * failing subsets of it. Indicator names are chosen per check — `database`,
 * `memoryHeap` — so the maps are keyed dynamically rather than by a fixed set
 * of fields.
 */
export class HealthCheckResultDto {
  @ApiProperty({
    description: '`error` when any indicator failed.',
    enum: ['ok', 'error', 'shutting_down'],
    example: 'ok',
  })
  status!: string;

  @ApiPropertyOptional({
    description: 'Indicators that passed, keyed by indicator name.',
    type: 'object',
    additionalProperties: true,
    example: { database: { status: 'up' }, memoryHeap: { status: 'up' } },
  })
  info?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Indicators that failed, keyed by indicator name.',
    type: 'object',
    additionalProperties: true,
    example: {},
  })
  error?: Record<string, unknown>;

  @ApiProperty({
    description: 'Every indicator, passing and failing.',
    type: 'object',
    additionalProperties: true,
    example: { database: { status: 'up' }, memoryHeap: { status: 'up' } },
  })
  details!: Record<string, unknown>;
}
