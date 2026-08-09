import { ApiProperty } from '@nestjs/swagger';
import { WorkflowEntityType } from '@/generated/client';

/**
 * One recorded transition.
 *
 * Append-only: a mistake is corrected by a further transition, never by editing
 * or deleting the row that recorded it.
 */
export class WorkflowHistoryDto {
  @ApiProperty() id!: string;

  @ApiProperty({
    enum: WorkflowEntityType,
    description:
      'Polymorphic, so Applicant, Admission, Enrollment and Student share one ' +
      'transition engine rather than four history tables that drift apart.',
  })
  entityType!: WorkflowEntityType;

  @ApiProperty() entityId!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() branchId!: string;

  @ApiProperty({ type: String, nullable: true, example: 'UNDER_REVIEW' })
  oldStatus!: string | null;

  @ApiProperty({ example: 'APPROVED' }) newStatus!: string;

  @ApiProperty({
    description: 'The action that caused it, e.g. `approve`.',
    example: 'approve',
  })
  actionType!: string;

  @ApiProperty({ type: String, nullable: true }) remarks!: string | null;
  @ApiProperty({ type: String, nullable: true }) actionBy!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) timestamp!: Date;
}
