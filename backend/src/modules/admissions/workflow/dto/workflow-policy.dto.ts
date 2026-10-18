import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdmissionApplicationStatus } from '@/generated/client';
import { ADMISSION_WORKFLOW_PROFILES } from '@/modules/configuration/config.registry';
import { WorkflowAction } from '../workflow.transitions';

const SOURCES = ['BRANCH', 'ORGANIZATION', 'SYSTEM', 'DEFAULT'];

export class AdmissionPolicySourcesDto {
  @ApiProperty({ enum: SOURCES }) workflowProfile!: string;
  @ApiProperty({ enum: SOURCES }) offerValidityDays!: string;
  @ApiProperty({ enum: SOURCES }) allowDeferment!: string;
  @ApiProperty({ enum: SOURCES }) waitlistEnabled!: string;
  @ApiProperty({ enum: SOURCES }) feeStepEnabled!: string;
  @ApiProperty({ enum: SOURCES }) documentRequestEnabled!: string;
}

/** The admission policy in force for the caller's organization and branch. */
export class AdmissionPolicyDto {
  @ApiProperty({ enum: ADMISSION_WORKFLOW_PROFILES })
  workflowProfile!: string;

  @ApiProperty({ example: 15 }) offerValidityDays!: number;
  @ApiProperty() allowDeferment!: boolean;
  @ApiProperty() waitlistEnabled!: boolean;
  @ApiProperty() feeStepEnabled!: boolean;
  @ApiProperty() documentRequestEnabled!: boolean;

  @ApiProperty({
    type: AdmissionPolicySourcesDto,
    description:
      'Which tier answered each value: a BRANCH override, the ORGANIZATION, the SYSTEM default, or the registry DEFAULT when nothing is set.',
  })
  sources!: AdmissionPolicySourcesDto;

  @ApiProperty({ type: String, format: 'date-time' })
  asOf!: Date;
}

export class MissingDocumentDto {
  @ApiProperty() documentTypeId!: string;
  @ApiProperty({ example: 'BIRTH_CERT' }) code!: string;
  @ApiProperty({ example: 'Birth certificate' }) name!: string;
}

export class WorkflowActionBlockerDto {
  @ApiProperty({
    example: 'DOCUMENTS_INCOMPLETE',
    description:
      'The same error code the action would fail with: DOCUMENTS_INCOMPLETE, POLICY_DISABLED, DEFERMENT_DISABLED, MAKER_CHECKER_VIOLATION, OFFER_EXPIRED, …',
  })
  code!: string;

  @ApiProperty() message!: string;

  @ApiPropertyOptional({
    type: [MissingDocumentDto],
    description: 'Present for DOCUMENTS_INCOMPLETE: the documents still owed.',
  })
  missing?: MissingDocumentDto[];
}

export class WorkflowActionDescriptorDto {
  @ApiProperty({ enum: WorkflowAction }) action!: WorkflowAction;
  @ApiProperty({ enum: AdmissionApplicationStatus })
  to!: AdmissionApplicationStatus;
  @ApiProperty({ enum: ['REQUIRED', 'OPTIONAL'] }) remarks!: string;
  @ApiProperty({ description: 'Whether the caller holds the permission.' })
  permitted!: boolean;
  @ApiProperty({ type: [WorkflowActionBlockerDto] })
  blockedBy!: WorkflowActionBlockerDto[];
  @ApiProperty({ description: 'Permitted and not blocked, as of now.' })
  available!: boolean;
  @ApiProperty({
    enum: ['TRANSITION', 'ADMIT'],
    description:
      'TRANSITION: POST …/workflow/transition. ADMIT: POST …/admit (or …/direct-admit under SIMPLE_ADMISSION).',
  })
  via!: string;
}

export class DirectAdmissionAvailabilityDto {
  @ApiProperty({ description: 'The profile is SIMPLE_ADMISSION.' })
  offered!: boolean;
  @ApiProperty({ description: 'It can start from the current status.' })
  fromCurrentState!: boolean;
  @ApiProperty({
    description:
      'The caller holds admissions.update, admissions.approve and student.create.',
  })
  permitted!: boolean;
  @ApiProperty() available!: boolean;
}

/**
 * What the caller may do next. Advice, accurate as of the read: every action
 * is re-validated under the applicant lock when it runs.
 */
export class WorkflowActionsDto {
  @ApiProperty() applicantId!: string;
  @ApiProperty({ enum: AdmissionApplicationStatus })
  status!: AdmissionApplicationStatus;
  @ApiProperty({ enum: ADMISSION_WORKFLOW_PROFILES }) profile!: string;
  @ApiProperty({
    type: String,
    format: 'date-time',
    description:
      'Policy is resolved as of submission, so an in-flight application keeps the process it entered. Drafts use now.',
  })
  policyAsOf!: Date;
  @ApiProperty({ type: [WorkflowActionDescriptorDto] })
  actions!: WorkflowActionDescriptorDto[];
  @ApiProperty({ type: DirectAdmissionAvailabilityDto })
  directAdmission!: DirectAdmissionAvailabilityDto;
}

export class ChecklistItemDto {
  @ApiProperty() requirementId!: string;
  @ApiProperty() documentTypeId!: string;
  @ApiProperty({ example: 'BIRTH_CERT' }) code!: string;
  @ApiProperty({ example: 'Birth certificate' }) name!: string;
  @ApiProperty({
    enum: AdmissionApplicationStatus,
    description:
      'Enforced when a checklist-guarded action leaves or enters this status.',
  })
  requiredByStage!: AdmissionApplicationStatus;
  @ApiProperty() isMandatory!: boolean;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Null for an organization-wide requirement.',
  })
  branchId!: string | null;
  @ApiProperty({
    enum: ['VERIFIED', 'PENDING_VERIFICATION', 'REJECTED', 'MISSING'],
    description: 'Only VERIFIED satisfies a requirement.',
  })
  status!: string;
  @ApiProperty({ type: String, nullable: true }) documentId!: string | null;
  @ApiProperty() satisfied!: boolean;
}

/** Every requirement that binds the applicant, by the guard's own rules. */
export class ApplicantChecklistDto {
  @ApiProperty() applicantId!: string;
  @ApiProperty({ enum: AdmissionApplicationStatus })
  status!: AdmissionApplicationStatus;
  @ApiProperty({ type: [ChecklistItemDto] }) items!: ChecklistItemDto[];
  @ApiProperty({
    description:
      'Mandatory requirements not yet satisfied by a verified document.',
  })
  outstandingMandatory!: number;
}
