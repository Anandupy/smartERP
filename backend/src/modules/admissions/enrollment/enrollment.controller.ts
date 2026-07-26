import { Controller, Get, Post, Body, Param, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { EnrollmentService } from './enrollment.service';
import { CreateEnrollmentDto } from './dto/enrollment.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RequireBranch } from '@/common/decorators/branch.decorator';
import { RequireAcademicYear } from '@/common/decorators/academic-year.decorator';
import { UserRole } from '@/common/enums/role.enum';

@ApiTags('Enrollment Placements')
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
@Controller('admissions/applicants/:applicantId/enrollment')
export class EnrollmentController {
  constructor(private readonly service: EnrollmentService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({
    summary:
      'Enroll an approved applicant into a program and class academic unit',
  })
  async create(
    @Param('applicantId') applicantId: string,
    @Body() dto: CreateEnrollmentDto,
    @Req() req: any,
  ) {
    const orgId = req.context?.organizationId || '';
    const branchId = req.context?.branchId || '';
    const academicYearId = req.context?.academicYearId || '';

    const data = await this.service.createEnrollment(
      applicantId,
      dto,
      orgId,
      branchId,
      academicYearId,
    );
    return { data, message: 'Applicant enrolled successfully' };
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @ApiOperation({ summary: 'Get enrollment details for an applicant' })
  async get(@Param('applicantId') applicantId: string) {
    const data = await this.service.getEnrollment(applicantId);
    return { data, message: 'Enrollment details retrieved successfully' };
  }
}
