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
import { ApplicantService, DRAFT_DELETE_ROLES } from './applicant.service';
import { ApplicantPreferenceService } from './applicant-preference.service';
import { SetProgramPreferencesDto } from './dto/preference.dto';
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
import { resourceScopeOf } from '@/common/scope/resource-scope';
import { AuthenticatedRequest } from '@/common/logger/request-context.types';
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
  constructor(
    private readonly service: ApplicantService,
    private readonly preferences: ApplicantPreferenceService,
  ) {}

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
  async create(
    @Body() dto: CreateApplicantDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const scope = resourceScopeOf(req.context, { requireAcademicYear: true });
    const result = await this.service.create(
      dto,
      scope,
      req.userId ?? undefined,
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
  async checkDupes(
    @Body() dto: CheckDuplicatesDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.service.checkDuplicates(
      dto,
      resourceScopeOf(req.context),
    );
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
  async findAll(
    @Query() query: QueryApplicantDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const scope = resourceScopeOf(req.context, { requireAcademicYear: true });
    const data = await this.service.findAll(query, scope);
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
  async findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const data = await this.service.findOne(id, resourceScopeOf(req.context));
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
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.update(
      id,
      dto,
      resourceScopeOf(req.context),
      req.userId ?? undefined,
    );
    return { data, message: 'Applicant updated successfully' };
  }

  @Delete(':id')
  @Roles(...DRAFT_DELETE_ROLES)
  @RequirePermission(PERMISSIONS.Admissions.Delete)
  @ApiOperation({
    summary: 'Soft delete a draft applicant',
    description:
      'Only a DRAFT may be deleted — anything submitted is closed by withdraw or cancel. ' +
      'Refused with 403 APPLICANT_NOT_DELETABLE otherwise, including when the draft was submitted concurrently.',
  })
  @ApiEmptyEnvelope({ message: 'Applicant deleted successfully' })
  @ApiStandardErrors(404)
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.service.remove(
      id,
      resourceScopeOf(req.context),
      req.userId ?? undefined,
    );
    return { message: 'Applicant deleted successfully' };
  }

  @Get(':id/preferences')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Admissions.View)
  @ApiOperation({
    summary: 'Ordered programme preferences',
    description:
      'Empty for a school, which sets the programme directly. Only institutions ' +
      'running an allotment round rank choices.',
  })
  @ApiStandardErrors(404)
  async listPreferences(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.preferences.list(
      id,
      resourceScopeOf(req.context, { requireAcademicYear: true }),
    );
    return { data, message: 'Programme preferences retrieved successfully' };
  }

  @Post(':id/preferences')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Admissions.Update)
  @ApiOperation({
    summary: 'Set the ordered programme preferences',
    description:
      'Replaces the whole list. Positions come from array order, so a client cannot ' +
      'send two entries claiming the same place, and a reorder is one atomic write ' +
      'rather than a sequence during which two rows briefly share a position.',
  })
  @ApiStandardErrors(400, 404, 409)
  async setPreferences(
    @Param('id') id: string,
    @Body() dto: SetProgramPreferencesDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.preferences.replaceAll(
      id,
      dto.preferences,
      resourceScopeOf(req.context, { requireAcademicYear: true }),
    );
    return { data, message: 'Programme preferences saved successfully' };
  }
}
