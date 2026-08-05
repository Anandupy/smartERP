import { Controller, Get, Post, Body, Param, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { WorkflowService } from './workflow.service';
import { TransitionDto } from './dto/workflow.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RequireBranch } from '@/common/decorators/branch.decorator';
import { RequireAcademicYear } from '@/common/decorators/academic-year.decorator';
import { UserRole } from '@/common/enums/role.enum';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import { ApplicantDto } from '../applicant/dto/applicant-response.dto';
import { WorkflowHistoryDto } from './dto/workflow-response.dto';

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
  constructor(private readonly service: WorkflowService) {}

  @Post('transition')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({
    summary:
      'Transition an applicant state (submit, review, approve, reject, cancel)',
  })
  @ApiCreatedEnvelope(ApplicantDto, {
    description:
      'The updated applicant. An illegal transition is rejected with 400 and the applicant is unchanged.',
    message: 'Applicant successfully transitioned to state APPROVED',
  })
  @ApiStandardErrors(404)
  async transition(
    @Param('applicantId') applicantId: string,
    @Body() dto: TransitionDto,
    @Req() req: any,
  ) {
    const data = await this.service.transitionState(
      applicantId,
      dto,
      req.userId,
    );
    return {
      data,
      message: `Applicant successfully transitioned to state ${dto.newStatus}`,
    };
  }

  @Get('history')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @ApiOperation({
    summary: 'Get workflow transition history for an applicant',
    description: 'Newest transition first.',
  })
  @ApiOkEnvelope(WorkflowHistoryDto, {
    isArray: true,
    message: 'Workflow history retrieved successfully',
  })
  @ApiStandardErrors(404)
  async getHistory(@Param('applicantId') applicantId: string) {
    const data = await this.service.getHistory(applicantId);
    return { data, message: 'Workflow history retrieved successfully' };
  }
}
