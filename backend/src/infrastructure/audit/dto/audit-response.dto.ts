import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  AUDIT_SEVERITIES,
  AUDIT_STATUSES,
  AuditSeverity,
  AuditStatus,
  FieldChange,
} from '../audit.types';

/** One field a write altered, as an emitter reports it. */
export class AuditFieldChangeDto implements FieldChange {
  @ApiProperty({ example: 'isActive' })
  field!: string;

  @ApiPropertyOptional({
    description: 'The value before the write. Absent on a create.',
    example: true,
  })
  oldValue?: unknown;

  @ApiPropertyOptional({
    description: 'The value after the write. Absent on a delete.',
    example: false,
  })
  newValue?: unknown;
}

/**
 * An audit log entry.
 *
 * `metadata` and `changes` are only selected when the request sets
 * `includeDetails`, so they are absent from a default list rather than null.
 */
@ApiExtraModels(AuditFieldChangeDto)
export class AuditLogDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5c00' })
  id!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  timestamp!: Date;

  @ApiProperty({ example: 'ApplicantCreated' })
  eventName!: string;

  @ApiProperty({ example: 'CREATE' })
  action!: string;

  @ApiProperty({ example: 'admissions' })
  module!: string;

  @ApiProperty({ example: 'Applicant' })
  aggregateType!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5ab0' })
  aggregateId!: string;

  @ApiProperty({ type: String, nullable: true })
  userId!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'asha.verma@example.edu',
  })
  userEmail!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'BRANCH_ADMIN' })
  role!: string | null;

  @ApiProperty({ type: String, nullable: true })
  organizationId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  branchId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  academicYearId!: string | null;

  @ApiProperty({
    type: String,
    description: 'Correlates with the `requestId` of the response envelope.',
    nullable: true,
    example: '019fc2a1-0d7c-76cd-86ec-cbdf1628a566',
  })
  requestId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  traceId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  correlationId!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '203.0.113.42' })
  ipAddress!: string | null;

  @ApiProperty({ type: String, nullable: true })
  userAgent!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'POST' })
  httpMethod!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '/v1/admissions/applicants',
  })
  route!: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 128 })
  executionTime!: number | null;

  @ApiProperty({
    description:
      'Defaults to INFO. An emitter raises it through the event metadata.',
    enum: AUDIT_SEVERITIES,
    example: 'INFO',
  })
  severity!: AuditSeverity;

  @ApiProperty({
    description: 'Defaults to SUCCESS.',
    enum: AUDIT_STATUSES,
    example: 'SUCCESS',
  })
  status!: AuditStatus;

  @ApiPropertyOptional({
    description: 'Only present when the query sets `includeDetails`.',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  metadata?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    description:
      'What the write altered, field by field. Only present when the query sets `includeDetails`. Emitters that report a diff send an array of FieldChange; the column is unconstrained JSON, so an emitter that reports something else is stored as sent.',
    oneOf: [
      { type: 'array', items: { $ref: getSchemaPath(AuditFieldChangeDto) } },
      { type: 'object', additionalProperties: true },
    ],
    nullable: true,
  })
  changes?: FieldChange[] | Record<string, unknown> | null;
}

/** A timeline event: the columns a chronological view needs, nothing more. */
export class AuditTimelineEventDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5c00' })
  id!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  timestamp!: Date;

  @ApiProperty({ example: 'ApplicantCreated' })
  eventName!: string;

  @ApiProperty({ example: 'CREATE' })
  action!: string;

  @ApiProperty({ example: 'admissions' })
  module!: string;

  @ApiProperty({ example: 'Applicant' })
  aggregateType!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5ab0' })
  aggregateId!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'asha.verma@example.edu',
  })
  userEmail!: string | null;

  @ApiProperty({ enum: AUDIT_SEVERITIES, example: 'INFO' })
  severity!: AuditSeverity;

  @ApiProperty({ enum: AUDIT_STATUSES, example: 'SUCCESS' })
  status!: AuditStatus;
}

/** Entries per module. */
export class AuditModuleCountDto {
  @ApiProperty({ example: 'admissions' })
  module!: string;

  @ApiProperty({ example: 412 })
  count!: number;
}

/** Entries per action. */
export class AuditActionCountDto {
  @ApiProperty({ example: 'CREATE' })
  action!: string;

  @ApiProperty({ example: 180 })
  count!: number;
}

/** Entries per severity. */
export class AuditSeverityCountDto {
  @ApiProperty({ enum: AUDIT_SEVERITIES, example: 'INFO' })
  severity!: AuditSeverity;

  @ApiProperty({ example: 1180 })
  count!: number;
}

/** Entries per outcome. */
export class AuditStatusCountDto {
  @ApiProperty({ enum: AUDIT_STATUSES, example: 'SUCCESS' })
  status!: AuditStatus;

  @ApiProperty({ example: 1174 })
  count!: number;
}

/**
 * Audit counts grouped four ways over the same filtered set, so the four
 * breakdowns each sum to `totalCount`.
 */
export class AuditSummaryDto {
  @ApiProperty({ example: 1204 })
  totalCount!: number;

  @ApiProperty({ type: [AuditModuleCountDto] })
  byModule!: AuditModuleCountDto[];

  @ApiProperty({ type: [AuditActionCountDto] })
  byAction!: AuditActionCountDto[];

  @ApiProperty({ type: [AuditSeverityCountDto] })
  bySeverity!: AuditSeverityCountDto[];

  @ApiProperty({ type: [AuditStatusCountDto] })
  byStatus!: AuditStatusCountDto[];
}

/** Entries recorded on one calendar day, UTC. */
export class AuditDailyActivityDto {
  @ApiProperty({ example: '2026-08-04' })
  date!: string;

  @ApiProperty({ example: 87 })
  count!: number;
}

/**
 * A chronological view.
 *
 * `dailyActivity` covers the whole filtered range; `events` is one page of it,
 * newest first.
 */
export class AuditTimelineDto {
  @ApiProperty({ type: [AuditDailyActivityDto] })
  dailyActivity!: AuditDailyActivityDto[];

  @ApiProperty({ type: [AuditTimelineEventDto] })
  events!: AuditTimelineEventDto[];
}
