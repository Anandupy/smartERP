import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { ApplicantService } from './applicant.service';
import {
  CreateApplicantDto,
  UpdateApplicantDto,
  QueryApplicantDto,
  CheckDuplicatesDto,
} from './dto/applicant.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RequireBranch } from '@/common/decorators/branch.decorator';
import { RequireAcademicYear } from '@/common/decorators/academic-year.decorator';
import { UserRole } from '@/common/enums/role.enum';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import {
  ApiCreatedEnvelope,
  ApiEmptyEnvelope,
  ApiOkEnvelope,
  ApiPaginatedItemsEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import {
  ApplicantDetailDto,
  ApplicantDto,
  ApplicantListItemDto,
  DuplicateCheckResultDto,
} from './dto/applicant-response.dto';

@ApiTags('Applicants')
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
@Controller('admissions/applicants')
export class ApplicantController {
  constructor(private readonly service: ApplicantService) {}

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Admissions.Create)
  @ApiOperation({
    summary: 'Register a new applicant',
    description:
      'Runs a duplicate check but does not block on it. The handler returns the applicant alone; the duplicate warnings it computes are not part of the response.',
  })
  @ApiCreatedEnvelope(ApplicantDto, {
    message: 'Applicant registered successfully',
  })
  @ApiStandardErrors(404, 409)
  async create(@Body() dto: CreateApplicantDto, @Req() req: any) {
    const orgId = req.context?.organizationId || '';
    const branchId = req.context?.branchId || '';
    const academicYearId = req.context?.academicYearId || '';

    const result = await this.service.create(
      dto,
      orgId,
      branchId,
      academicYearId,
      req.userId,
    );
    return {
      data: result.applicant,
      warnings: result.warnings,
      message: 'Applicant registered successfully',
    };
  }

  @Post('check-duplicates')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Admissions.View)
  @ApiOperation({
    summary: 'Check for potential duplicate applicant records',
    description:
      'Matches on Aadhaar, primary mobile, or name and date of birth within the branch. Advisory only.',
  })
  @ApiCreatedEnvelope(DuplicateCheckResultDto, {
    message: 'Duplicate check completed',
  })
  @ApiStandardErrors()
  async checkDupes(@Body() dto: CheckDuplicatesDto, @Req() req: any) {
    const branchId = req.context?.branchId || '';
    const result = await this.service.checkDuplicates(dto, branchId);
    return { data: result, message: 'Duplicate check completed' };
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Admissions.View)
  @ApiOperation({
    summary: 'Get all applicants for branch and academic year (filtered/paged)',
  })
  @ApiPaginatedItemsEnvelope(ApplicantListItemDto, {
    message: 'Applicants retrieved successfully',
    description:
      'Pagination is nested inside `data` as `{ items, meta }`; the envelope’s own `meta` stays empty.',
  })
  @ApiStandardErrors()
  async findAll(@Query() query: QueryApplicantDto, @Req() req: any) {
    const branchId = req.context?.branchId || '';
    const academicYearId = req.context?.academicYearId || '';
    const data = await this.service.findAll(query, branchId, academicYearId);
    return { data, message: 'Applicants retrieved successfully' };
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Admissions.View)
  @ApiOperation({ summary: 'Get applicant details by ID' })
  @ApiOkEnvelope(ApplicantDetailDto, {
    message: 'Applicant details retrieved successfully',
  })
  @ApiStandardErrors(404)
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { data, message: 'Applicant details retrieved successfully' };
  }

  @Patch(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Admissions.Update)
  @ApiOperation({ summary: 'Update applicant details' })
  @ApiOkEnvelope(ApplicantDto, { message: 'Applicant updated successfully' })
  @ApiStandardErrors(404)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateApplicantDto,
    @Req() req: any,
  ) {
    const data = await this.service.update(id, dto, req.userId);
    return { data, message: 'Applicant updated successfully' };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.Admissions.Delete)
  @ApiOperation({ summary: 'Soft delete applicant' })
  @ApiEmptyEnvelope({ message: 'Applicant deleted successfully' })
  @ApiStandardErrors(404)
  async remove(@Param('id') id: string, @Req() req: any) {
    await this.service.remove(id, req.userId);
    return { message: 'Applicant deleted successfully' };
  }
}
