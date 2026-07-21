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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Register a new applicant' })
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
  @ApiOperation({ summary: 'Check for potential duplicate applicant records' })
  async checkDupes(
    @Body() dto: CheckDuplicatesDto,
    @Req() req: any,
  ) {
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
  @ApiOperation({
    summary: 'Get all applicants for branch and academic year (filtered/paged)',
  })
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
  @ApiOperation({ summary: 'Get applicant details by ID' })
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
  @ApiOperation({ summary: 'Update applicant details' })
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
  @ApiOperation({ summary: 'Soft delete applicant' })
  async remove(@Param('id') id: string, @Req() req: any) {
    await this.service.remove(id, req.userId);
    return { message: 'Applicant deleted successfully' };
  }
}
