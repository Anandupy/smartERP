import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdmissionApplicationStatus } from '@/generated/client';
import { WorkflowAction } from '../workflow.transitions';

export { AdmissionApplicationStatus as WorkflowState, WorkflowAction };

/**
 * A workflow command.
 *
 * The client names a **verb**, never a destination state. `{ action: "approve" }`
 * rather than `{ newStatus: "APPROVED" }`, because the engine owns where each
 * action leads: a client that could name the destination could ask for
 * `ADMITTED` and produce an applicant marked admitted with no student behind
 * them, which is precisely what the state machine exists to prevent.
 *
 * `admit` is absent from the reachable set — it is Phase 5, and it writes far
 * more than a status.
 */
export class TransitionApplicantDto {
  @ApiProperty({
    enum: WorkflowAction,
    description:
      'The action to apply. The engine derives the resulting state from the ' +
      'current one; the destination is never supplied by the caller.',
    example: WorkflowAction.APPROVE,
  })
  @IsEnum(WorkflowAction)
  action!: WorkflowAction;

  @ApiPropertyOptional({
    description:
      'Why. Required for rejection, waitlisting, deferment, withdrawal, ' +
      'cancellation, a document request and a force-reopen. Blank and ' +
      'whitespace are rejected — a mandatory reason that accepts a space is a ' +
      'mandatory keystroke.',
    example: 'Documents verified; seat offered for the 2026 intake.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  remarks?: string;
}
