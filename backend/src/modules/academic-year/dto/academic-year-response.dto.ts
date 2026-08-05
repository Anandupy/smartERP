import { ApiProperty } from '@nestjs/swagger';

/**
 * A branch's academic session.
 *
 * `isActive`, `isSelected` and `isLocked` are independent: at most one year per
 * branch is active and at most one is selected, and either can be locked.
 * `isSelected` is the year the tenant header defaults to.
 */
export class AcademicYearDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6d' })
  id!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6c' })
  branchId!: string;

  @ApiProperty({ example: '2026-2027' })
  name!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  startDate!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  endDate!: Date;

  @ApiProperty({
    description: 'At most one active year per branch.',
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    description: 'The year the branch currently works in.',
    example: true,
  })
  isSelected!: boolean;

  @ApiProperty({
    description: 'A locked year rejects updates.',
    example: false,
  })
  isLocked!: boolean;

  @ApiProperty({ example: false })
  isDeleted!: boolean;

  @ApiProperty({ type: String, nullable: true })
  createdBy!: string | null;

  @ApiProperty({ type: String, nullable: true })
  updatedBy!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
