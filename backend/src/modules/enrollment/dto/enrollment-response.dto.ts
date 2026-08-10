import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EnrollmentKind,
  EnrollmentOriginType,
  EnrollmentResultOutcome,
  EnrollmentStatus,
} from '@/generated/client';

/**
 * One academic-year placement.
 *
 * Carries identifiers and placement facts, and no demographics. A client that
 * needs a name asks Student for it — copying one here is the first step toward
 * twelve stale copies of a corrected spelling.
 */
export class EnrollmentDto {
  @ApiProperty({ example: '019f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5af0' })
  id!: string;

  @ApiProperty({ example: '019f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6b' })
  organizationId!: string;

  @ApiProperty({ example: '019f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6c' })
  branchId!: string;

  @ApiProperty({ example: '019f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6d' })
  academicYearId!: string;

  @ApiProperty({
    description: 'The spell of study this year belongs to.',
    example: '019f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a70',
  })
  admissionId!: string;

  @ApiProperty({ example: '019f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a71' })
  studentId!: string;

  @ApiProperty({ example: '019f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a80' })
  programId!: string;

  @ApiProperty({
    description:
      'The leaf placement node — the section, not the class above it.',
    example: '019f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a90',
  })
  academicUnitId!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Position in this class register for this year. Not an identifier, and not stable across years.',
    example: '17',
  })
  rollNumber!: string | null;

  @ApiProperty({ enum: EnrollmentKind, example: EnrollmentKind.PRIMARY })
  enrollmentKind!: EnrollmentKind;

  @ApiProperty({ enum: EnrollmentStatus, example: EnrollmentStatus.ACTIVE })
  enrollmentStatus!: EnrollmentStatus;

  @ApiProperty({ example: false })
  isRepeat!: boolean;

  @ApiProperty({
    enum: EnrollmentResultOutcome,
    nullable: true,
    description: 'Written by Examination alone. Never set by this module.',
    example: null,
  })
  resultOutcome!: EnrollmentResultOutcome | null;

  @ApiProperty({
    enum: EnrollmentOriginType,
    description:
      'Why this row exists. Recorded, never inferred from timestamps.',
    example: EnrollmentOriginType.ADMISSION,
  })
  originType!: EnrollmentOriginType;

  @ApiProperty({ type: String, nullable: true, example: null })
  previousEnrollmentId!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The row that replaced this one, if any.',
    example: null,
  })
  supersededById!: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  changeReason!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Provenance only. Never used to look anything up.',
    example: null,
  })
  applicantId!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  exitDate!: Date | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  exitReason!: string | null;

  @ApiProperty({
    description: 'Send this back as `expectedVersion` to detect a lost update.',
    example: 1,
  })
  version!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  deletedAt!: Date | null;
}

/** Both halves of a supersede, so a client can render the change. */
export class SupersededEnrollmentDto {
  @ApiProperty({
    type: EnrollmentDto,
    description:
      'The closed row, left exactly as it was apart from its status.',
  })
  previous!: EnrollmentDto;

  @ApiProperty({ type: EnrollmentDto, description: 'The live replacement.' })
  current!: EnrollmentDto;
}

/** One recorded placement transition. */
export class EnrollmentHistoryDto {
  @ApiProperty({ example: '019f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5ac0' })
  id!: string;

  @ApiProperty({ example: 'ENROLLMENT' })
  entityType!: string;

  @ApiProperty({ example: '019f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5af0' })
  entityId!: string;

  @ApiProperty({ type: String, nullable: true, example: 'ACTIVE' })
  oldStatus!: string | null;

  @ApiProperty({ example: 'SUPERSEDED' })
  newStatus!: string;

  @ApiProperty({ example: 'CORRECTION' })
  actionType!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  remarks!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'SYSTEM' })
  actionBy!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  timestamp!: Date;
}
