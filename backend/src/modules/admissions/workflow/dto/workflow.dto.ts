import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum WorkflowState {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  DOCUMENT_PENDING = 'DOCUMENT_PENDING',
  FEE_PENDING = 'FEE_PENDING',
  WAITLISTED = 'WAITLISTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export class TransitionDto {
  @ApiProperty({ description: 'Target workflow state', enum: WorkflowState })
  @IsEnum(WorkflowState)
  newStatus!: WorkflowState;

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
