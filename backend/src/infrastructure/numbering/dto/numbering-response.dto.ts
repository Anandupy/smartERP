import { ApiProperty } from '@nestjs/swagger';
import {
  AllocationMode,
  ResetStrategy,
  SequencePurpose,
  SequenceScope,
  SequenceYearFormat,
} from '@/generated/client';

/**
 * A configured business-identifier sequence.
 *
 * `format` names the parts to assemble; the remaining fields decide what each
 * part expands to, where uniqueness is enforced, and whether the counter
 * restarts.
 */
export class NumberSequenceConfigDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5b00' })
  id!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6b' })
  organizationId!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Null for an ORGANIZATION-scoped sequence.',
    example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6c',
  })
  branchId!: string | null;

  @ApiProperty({
    enum: SequenceScope,
    description:
      'Where the counter and its uniqueness live. Identity numbers are ' +
      'ORGANIZATION-scoped so they survive a branch transfer.',
    example: SequenceScope.ORGANIZATION,
  })
  scope!: SequenceScope;

  @ApiProperty({ enum: SequencePurpose, example: SequencePurpose.STUDENT_CODE })
  purpose!: SequencePurpose;

  @ApiProperty({
    enum: AllocationMode,
    description:
      'GAPLESS allocates inside the caller transaction and leaves no holes, at ' +
      'the cost of serialising the purpose. MONOTONIC commits immediately and ' +
      'permits gaps.',
    example: AllocationMode.MONOTONIC,
  })
  allocationMode!: AllocationMode;

  @ApiProperty({ type: String, nullable: true, example: 'STU' })
  prefix!: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  suffix!: string | null;

  @ApiProperty({ example: false })
  includeBranchCode!: boolean;

  @ApiProperty({ example: false })
  includeAcademicYear!: boolean;

  @ApiProperty({
    description: 'Zero-padding width of the counter.',
    example: 10,
  })
  sequencePadding!: number;

  @ApiProperty({ example: '{prefix}{sequence}' })
  format!: string;

  @ApiProperty({
    enum: SequenceYearFormat,
    description: 'How {year} renders, when the format uses one.',
    example: SequenceYearFormat.NAME,
  })
  yearFormat!: SequenceYearFormat;

  @ApiProperty({
    enum: ResetStrategy,
    description: 'YEARLY restarts the counter each academic year.',
    example: ResetStrategy.NEVER,
  })
  resetStrategy!: ResetStrategy;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  deletedAt!: Date | null;
}

export class NumberSequencePreviewDto {
  @ApiProperty({ enum: SequencePurpose, example: SequencePurpose.STUDENT_CODE })
  purpose!: SequencePurpose;

  @ApiProperty({
    description: 'The counter value rendered. Nothing was consumed.',
    example: 123,
  })
  sampleValue!: number;

  @ApiProperty({ example: 'STU0000000123' })
  rendered!: string;
}
