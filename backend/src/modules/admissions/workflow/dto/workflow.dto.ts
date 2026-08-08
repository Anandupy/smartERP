import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdmissionApplicationStatus } from '@/generated/client';

/**
 * The applicant workflow states.
 *
 * Re-exported from the Prisma enum rather than declared a second time. A local
 * copy is a copy that drifts: the column and the DTO would disagree the first
 * time one of them gained a state, and the disagreement would surface as a
 * runtime cast failure rather than a build error.
 */
export { AdmissionApplicationStatus as WorkflowState };

export class TransitionDto {
  @ApiProperty({
    description: 'Target workflow state',
    enum: AdmissionApplicationStatus,
  })
  @IsEnum(AdmissionApplicationStatus)
  newStatus!: AdmissionApplicationStatus;

  @ApiPropertyOptional({ description: 'Transition audit remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;

  @ApiPropertyOptional({
    description: 'Action type identifier, e.g. SUBMIT, APPROVE, REJECT',
  })
  @IsString()
  @IsOptional()
  actionType?: string;
}
