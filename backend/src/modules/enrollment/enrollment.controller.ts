import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { EnrollmentService } from './enrollment.service';
import {
  AssignRollNumberDto,
  CancelEnrollmentDto,
  CorrectEnrollmentDto,
  ListEnrollmentsQueryDto,
  TransferEnrollmentDto,
} from './dto/enrollment.dto';
import {
  EnrollmentDto,
  EnrollmentHistoryDto,
  SupersededEnrollmentDto,
} from './dto/enrollment-response.dto';
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

/**
 * Academic placement.
 *
 * **There is no `POST /enrollments` and no `DELETE`.** Every placement has an
 * origin operation behind it — admission, promotion, repeat, correction,
 * transfer, readmission, migration — and a bare create would produce a row that
 * cannot say why it exists. Deletion is equally absent: academic history is
 * cancelled or superseded, and both leave the original visible.
 *
 * What is here is four named operations and the reads that power a class list.
 * Each route is thin: validate, authorise, resolve scope, call the service. No
 * transaction, no status write, no event publishing happens at this layer.
 */
@ApiTags('Enrollment')
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
@Controller('enrollments')
export class EnrollmentController {
  constructor(private readonly enrollments: EnrollmentService) {}

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Enrollment.View)
  @ApiOperation({
    summary: 'List placements by unit, programme, year or status',
    description:
      'The class-list query — filter by `academicUnitId` and `academicYearId` to get the register that attendance, examination and the timetable all read. Branch and organization come from the execution context and cannot be filtered.',
  })
  @ApiOkEnvelope(EnrollmentDto, {
    isArray: true,
    message: 'Enrollments retrieved successfully',
  })
  async list(
    @Query() query: ListEnrollmentsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.enrollments.search(
      query,
      resourceScopeOf(req.context, { requireAcademicYear: true }),
    );

    return {
      data: result.items,
      meta: result,
      message: 'Enrollments retrieved successfully',
    };
  }

  @Get(':enrollmentId')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Enrollment.View)
  @ApiOperation({ summary: 'One placement' })
  @ApiOkEnvelope(EnrollmentDto, {
    message: 'Enrollment retrieved successfully',
  })
  @ApiStandardErrors(404)
  async findOne(
    @Param('enrollmentId') enrollmentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.enrollments.findById(
      enrollmentId,
      resourceScopeOf(req.context, { requireAcademicYear: true }),
    );
    return { data, message: 'Enrollment retrieved successfully' };
  }

  @Get(':enrollmentId/history')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Enrollment.View)
  @ApiOperation({
    summary: 'Transition history for one placement',
    description: 'Newest first. Scoped — history never crosses a branch.',
  })
  @ApiOkEnvelope(EnrollmentHistoryDto, {
    isArray: true,
    message: 'Enrollment history retrieved successfully',
  })
  @ApiStandardErrors(404)
  async history(
    @Param('enrollmentId') enrollmentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.enrollments.getHistory(
      enrollmentId,
      resourceScopeOf(req.context, { requireAcademicYear: true }),
    );
    return { data, message: 'Enrollment history retrieved successfully' };
  }

  @Post(':enrollmentId/correct')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.Enrollment.Correct)
  @ApiOperation({
    summary: 'Correct a wrong placement',
    description:
      'Writes a replacement and closes the original as SUPERSEDED. The original is never edited, so a report can still show what was recorded before and why it changed. A reason is mandatory and a blank one is refused.',
  })
  @ApiCreatedEnvelope(SupersededEnrollmentDto, {
    message: 'Placement corrected successfully',
  })
  @ApiStandardErrors(400, 403, 404)
  async correct(
    @Param('enrollmentId') enrollmentId: string,
    @Body() dto: CorrectEnrollmentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.enrollments.correctPlacement(
      enrollmentId,
      dto,
      resourceScopeOf(req.context, { requireAcademicYear: true }),
      { userId: req.userId, role: req.context.role },
    );
    return { data, message: 'Placement corrected successfully' };
  }

  @Post(':enrollmentId/transfer')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.Enrollment.Correct)
  @ApiOperation({
    summary: 'Move a student mid-year, within the branch',
    description:
      'Closes the old placement as TRANSFERRED — the student really was there until now, and the attendance recorded against it stands — and opens a new one. Cross-branch movement is not this operation: it closes the admission and opens another, and there is no input here that can change the branch.',
  })
  @ApiCreatedEnvelope(SupersededEnrollmentDto, {
    message: 'Placement transferred successfully',
  })
  @ApiStandardErrors(400, 403, 404)
  async transfer(
    @Param('enrollmentId') enrollmentId: string,
    @Body() dto: TransferEnrollmentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.enrollments.transferPlacement(
      enrollmentId,
      dto,
      resourceScopeOf(req.context, { requireAcademicYear: true }),
      { userId: req.userId, role: req.context.role },
    );
    return { data, message: 'Placement transferred successfully' };
  }

  @Post(':enrollmentId/cancel')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.Enrollment.Cancel)
  @ApiOperation({
    summary: 'Void a placement',
    description:
      'Records a date and a reason and leaves the row in place. Refused once a result has been recorded against it, because marks pointing at a placement that officially never happened is worse than a wrong placement.',
  })
  @ApiOkEnvelope(EnrollmentDto, { message: 'Placement cancelled successfully' })
  @ApiStandardErrors(400, 403, 404)
  async cancel(
    @Param('enrollmentId') enrollmentId: string,
    @Body() dto: CancelEnrollmentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.enrollments.cancelEnrollment(
      enrollmentId,
      dto,
      resourceScopeOf(req.context, { requireAcademicYear: true }),
      { userId: req.userId, role: req.context.role },
    );
    return { data, message: 'Placement cancelled successfully' };
  }

  @Patch(':enrollmentId/roll-number')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Enrollment.RollNumberManage)
  @ApiOperation({
    summary: 'Assign or clear a class-register position',
    description:
      'The one mutable field on a placement, and only until the class list locks. It does not supersede the row: the student is in the same class before and after.',
  })
  @ApiOkEnvelope(EnrollmentDto, { message: 'Roll number updated successfully' })
  @ApiStandardErrors(400, 403, 404)
  async assignRollNumber(
    @Param('enrollmentId') enrollmentId: string,
    @Body() dto: AssignRollNumberDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.enrollments.assignRollNumber(
      enrollmentId,
      dto,
      resourceScopeOf(req.context, { requireAcademicYear: true }),
      { userId: req.userId, role: req.context.role },
    );
    return { data, message: 'Roll number updated successfully' };
  }
}
