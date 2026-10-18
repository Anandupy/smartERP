import { Controller, Get, Param, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '@/common/decorators/roles.decorator';
import { RequireBranch } from '@/common/decorators/branch.decorator';
import { RequireAcademicYear } from '@/common/decorators/academic-year.decorator';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import { UserRole } from '@/common/enums/role.enum';
import {
  ApiOkEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import { resourceScopeOf } from '@/common/scope/resource-scope';
import { AuthenticatedRequest } from '@/common/logger/request-context.types';
import { WorkflowService } from './workflow.service';
import {
  AdmissionPolicyDto,
  ApplicantChecklistDto,
} from './dto/workflow-policy.dto';

const ADMISSIONS_READERS = [
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.BRANCH_ADMIN,
  UserRole.STAFF,
];

/**
 * The effective admission policy for the caller's branch.
 *
 * Read-only and scoped to the resolved organization and branch: the profile
 * a client follows is whatever configuration says here, never a value it
 * supplies. Changing policy is `PUT /config/values/:key`.
 */
@ApiTags('Applicant Workflow')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-branch-id',
  required: true,
  description: 'Target Branch UUID',
})
@RequireBranch()
@Controller('admissions/workflow')
export class WorkflowPolicyController {
  constructor(private readonly workflow: WorkflowService) {}

  @Get('policy')
  @Roles(...ADMISSIONS_READERS)
  @RequirePermission(PERMISSIONS.Admissions.View)
  @ApiOperation({
    summary: 'Effective admission workflow policy for this branch',
    description:
      'The workflow profile (SIMPLE_ADMISSION, STANDARD_ADMISSION — the default — or VERIFIED_ADMISSION) and the optional-step switches, resolved BRANCH → ORGANIZATION → SYSTEM → default, with the tier that answered each. A new application follows this policy; one already submitted keeps the policy in force at its submission.',
  })
  @ApiOkEnvelope(AdmissionPolicyDto, {
    message: 'Admission policy retrieved successfully',
  })
  @ApiStandardErrors()
  async getPolicy(@Req() req: AuthenticatedRequest) {
    const scope = resourceScopeOf(req.context);
    const data = await this.workflow.policyFor(scope, null);
    return { data, message: 'Admission policy retrieved successfully' };
  }
}

/** The document checklist for one application, as the guards see it. */
@ApiTags('Applicant Workflow')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-branch-id',
  required: true,
  description: 'Target Branch UUID',
})
@ApiHeader({
  name: 'x-academic-year-id',
  required: true,
  description: 'Target Academic Year UUID',
})
@RequireBranch()
@RequireAcademicYear()
@Controller('admissions/applicants/:applicantId')
export class ApplicantChecklistController {
  constructor(private readonly workflow: WorkflowService) {}

  @Get('checklist')
  @Roles(...ADMISSIONS_READERS)
  @RequirePermission(PERMISSIONS.Admissions.View)
  @ApiOperation({
    summary: 'Document checklist for an application',
    description:
      'Every requirement binding the application — organization-wide or for its own branch, matched on programme, quota and category — with its stage and status. Only a VERIFIED current version satisfies a requirement. Uses the rules the workflow guards enforce, so a client never computes its own.',
  })
  @ApiOkEnvelope(ApplicantChecklistDto, {
    message: 'Document checklist retrieved successfully',
  })
  @ApiStandardErrors(404)
  async getChecklist(
    @Param('applicantId') applicantId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.workflow.describeChecklist(
      applicantId,
      resourceScopeOf(req.context, { requireAcademicYear: true }),
    );
    return { data, message: 'Document checklist retrieved successfully' };
  }
}
