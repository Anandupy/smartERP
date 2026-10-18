import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdmissionConversionService } from './admission-conversion.service';
import {
  AdmitApplicantDto,
  AdmitResultDto,
  DirectAdmitResultDto,
} from './dto/admit.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RequireBranch } from '@/common/decorators/branch.decorator';
import { RequireAcademicYear } from '@/common/decorators/academic-year.decorator';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import { UserRole } from '@/common/enums/role.enum';
import {
  ApiCreatedEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import { resourceScopeOf } from '@/common/scope/resource-scope';
import { AuthenticatedRequest } from '@/common/logger/request-context.types';

/**
 * The admission conversion endpoint.
 *
 * One command, because that is what the registrar does: they admit an
 * applicant. They do not create a student, then an admission, then an
 * enrolment — three requests that could each fail on their own and leave a
 * child half-admitted.
 *
 * The route-level permission is the coarse gate; the service additionally
 * requires `student.create`, because minting a permanent learner identity is a
 * larger power than approving a form and admission exercises both at once.
 */
@ApiTags('Admission Conversion')
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
export class AdmissionConversionController {
  constructor(private readonly conversion: AdmissionConversionService) {}

  @Post('admit')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.Admissions.Approve)
  @ApiOperation({
    summary: 'Admit a seat-confirmed applicant',
    description:
      'Creates the Student, the Admission and the first Enrollment and moves the application to ADMITTED — all in one transaction, so a failure anywhere leaves the applicant exactly as it was. ' +
      'The applicant row is locked before its state is read, so two registrars admitting at the same moment produce one student and one clean conflict naming it. ' +
      'A person who is already a student here is refused: returning students are readmitted against the existing identity, which is a separate operation.',
  })
  @ApiCreatedEnvelope(AdmitResultDto, {
    message: 'Applicant admitted successfully',
  })
  @ApiStandardErrors(400, 403, 404, 409)
  async admit(
    @Param('applicantId') applicantId: string,
    @Body() dto: AdmitApplicantDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.conversion.admit(
      applicantId,
      dto,
      resourceScopeOf(req.context, { requireAcademicYear: true }),
      { userId: req.userId, role: req.context.role },
    );

    return { data, message: 'Applicant admitted successfully' };
  }

  @Post('direct-admit')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.Admissions.Approve)
  @ApiOperation({
    summary: 'Directly admit an applicant (SIMPLE_ADMISSION profile)',
    description:
      'For branches whose effective workflow profile is SIMPLE_ADMISSION. Runs the remaining ordinary workflow actions — submit, startReview, approve, confirmSeat — and then admit, all in one transaction through the same engine and conversion as the standard path: every permission, guard (document checklist included), Person resolution, numbering rule, placement check, history row and event still applies. ' +
      'Requires admissions.update, admissions.approve and student.create. Any failure rolls everything back and leaves the applicant as it was. ' +
      'Refused with WORKFLOW_PROFILE_MISMATCH under any other profile.',
  })
  @ApiCreatedEnvelope(DirectAdmitResultDto, {
    message: 'Applicant admitted successfully',
  })
  @ApiStandardErrors(400, 403, 404, 409)
  async directAdmit(
    @Param('applicantId') applicantId: string,
    @Body() dto: AdmitApplicantDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.conversion.directAdmit(
      applicantId,
      dto,
      resourceScopeOf(req.context, { requireAcademicYear: true }),
      { userId: req.userId, role: req.context.role },
    );

    return { data, message: 'Applicant admitted successfully' };
  }
}
