import { ApiProperty } from '@nestjs/swagger';

/**
 * One entry in an applicant's admission-status audit trail.
 *
 * Written on every accepted transition, so the sequence of rows is the record
 * of who moved an applicant where and why.
 */
export class WorkflowHistoryDto {
  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5ae0' })
  id!: string;

  @ApiProperty({ example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5ab0' })
  applicantId!: string;

  @ApiProperty({
    type: String,
    description: 'The status the applicant left.',
    nullable: true,
    example: 'DRAFT',
  })
  oldStatus!: string | null;

  @ApiProperty({ example: 'SUBMITTED' })
  newStatus!: string;

  @ApiProperty({ example: 'STATUS_CHANGE' })
  actionType!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Documents verified.' })
  remarks!: string | null;

  @ApiProperty({
    type: String,
    description: 'User id, or SYSTEM for an automated transition.',
    nullable: true,
    example: '018f3a5b-7c9d-7e8f-9a0b-1c2d3e4f5a6a',
  })
  actionBy!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  timestamp!: Date;
}
