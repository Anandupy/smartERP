import { ApiProperty } from '@nestjs/swagger';

/**
 * A configured number sequence — admission form numbers, application numbers,
 * receipt numbers.
 *
 * `format` names the parts to assemble; the remaining fields decide what each
 * part expands to and whether the counter restarts.
 */
export class NumberSequenceConfigDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5b00' })
  id!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6b' })
  organizationId!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6c' })
  branchId!: string;

  @ApiProperty({
    description: 'One configuration per purpose per branch.',
    example: 'ADMISSION_FORM',
  })
  purpose!: string;

  @ApiProperty({ type: String, nullable: true, example: 'ADM' })
  prefix!: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  suffix!: string | null;

  @ApiProperty({ example: true })
  includeBranchCode!: boolean;

  @ApiProperty({ example: true })
  includeAcademicYear!: boolean;

  @ApiProperty({
    description: 'Zero-padding width of the counter.',
    example: 4,
  })
  sequencePadding!: number;

  @ApiProperty({ example: '{prefix}-{branchCode}-{year}-{sequence}' })
  format!: string;

  @ApiProperty({
    description: 'YEARLY restarts the counter each academic year.',
    enum: ['NEVER', 'YEARLY'],
    example: 'YEARLY',
  })
  resetStrategy!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  deletedAt!: Date | null;
}
