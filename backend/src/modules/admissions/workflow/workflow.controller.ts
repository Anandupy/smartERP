import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { WorkflowService } from './workflow.service';
import { TransitionApplicantDto } from './dto/workflow.dto';
import { WorkflowHistoryDto } from './dto/workflow-response.dto';
import { WorkflowActionsDto } from './dto/workflow-policy.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RequireBranch } from '@/common/decorators/branch.decorator';
import { RequireAcademicYear } from '@/common/decorators/academic-year.decorator';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import { UserRole } from '@/common/enums/role.enum';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import { resourceScopeOf } from '@/common/scope/resource-scope';
import { AuthenticatedRequest } from '@/common/logger/request-context.types';
import { ApplicantDto } from '../applicant/dto/applicant-response.dto';

/**
 * The applicant state machine.
 *
 * One endpoint for every transition rather than a route per verb. The
 * alternative — `/approve`, `/reject`, `/waitlist`, … — puts the transition
 * vocabulary in two places and guarantees they diverge; here the table is the
 * only definition and a new action needs no new route.
 *
 * The route-level permission is the coarse gate. Each action additionally
 * declares its own, checked inside the engine, so approving demands more than
 * editing even though both arrive here.
 */
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
@Controller('admissions/applicants/:applicantId/workflow')
export class WorkflowController {
  constructor(private readonly workflow: WorkflowService) {}

  @Post('transition')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Admissions.Update)
  @ApiOperation({
    summary: 'Apply a workflow action',
    description:
      'The caller names an action; the engine derives the resulting state. An action ' +
      'that is not legal from the current state is refused before anything is written, ' +
      'and the applicant row is locked before its state is read, so two administrators ' +
      'acting at the same moment produce one transition and one clean failure.',
  })
  @ApiCreatedEnvelope(ApplicantDto, {
    message: 'Workflow action applied successfully',
  })
  @ApiStandardErrors(400, 403, 404)
  async transition(
    @Param('applicantId') applicantId: string,
    @Body() dto: TransitionApplicantDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.workflow.transition(
      applicantId,
      { action: dto.action, remarks: dto.remarks },
      resourceScopeOf(req.context, { requireAcademicYear: true }),
      { userId: req.userId, role: req.context.role },
    );

    return {
      data,
      message: `Workflow action '${dto.action}' applied successfully`,
    };
  }

  @Get('actions')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Admissions.View)
  @ApiOperation({
    summary: 'Actions legal for an application, for this caller',
    description:
      'The authoritative list a client renders from — it must not keep its own copy of the transition graph. ' +
      'Each action reports whether the caller holds its permission and every guard currently blocking it (missing documents, a disabled policy step, maker/checker, an expired offer), using the error codes the action itself would return. ' +
      'Advice only: every action is re-validated under the applicant lock when it is performed. ' +
      '`directAdmission` reports whether the SIMPLE_ADMISSION one-step admission is available.',
  })
  @ApiOkEnvelope(WorkflowActionsDto, {
    message: 'Workflow actions retrieved successfully',
  })
  @ApiStandardErrors(404)
  async getActions(
    @Param('applicantId') applicantId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.workflow.describeActions(
      applicantId,
      resourceScopeOf(req.context, { requireAcademicYear: true }),
      { userId: req.userId, role: req.context.role },
    );

    return { data, message: 'Workflow actions retrieved successfully' };
  }

  @Get('history')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Admissions.View)
  @ApiOperation({
    summary: 'Transition history for an application',
    description: 'Newest first. Scoped — history never crosses a branch.',
  })
  @ApiOkEnvelope(WorkflowHistoryDto, {
    isArray: true,
    message: 'Workflow history retrieved successfully',
  })
  @ApiStandardErrors(404)
  async getHistory(
    @Param('applicantId') applicantId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.workflow.getHistory(
      applicantId,
      resourceScopeOf(req.context, { requireAcademicYear: true }),
    );

    return { data, message: 'Workflow history retrieved successfully' };
  }
}
