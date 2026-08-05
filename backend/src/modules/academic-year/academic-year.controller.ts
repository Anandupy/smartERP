import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
  ApiParam,
} from '@nestjs/swagger';
import { AcademicYearService } from './academic-year.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RequireBranch } from '@/common/decorators/branch.decorator';
import { UserRole } from '@/common/enums/role.enum';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { AllowDuringSetup } from '@/common/decorators/allow-during-setup.decorator';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import {
  ApiCreatedEnvelope,
  ApiEmptyEnvelope,
  ApiOkEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import { AcademicYearDto } from './dto/academic-year-response.dto';

@ApiTags('Academic Years')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-branch-id',
  required: true,
  description: 'Target Branch UUID',
})
@RequireBranch()
@Controller('academic-years')
export class AcademicYearController {
  constructor(private readonly academicYearService: AcademicYearService) {}

  @Post()
  @AllowDuringSetup()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({ summary: 'Create academic year' })
  @ApiCreatedEnvelope(AcademicYearDto, {
    message: 'Academic year created successfully',
  })
  @ApiStandardErrors(404, 409)
  async create(@Body() dto: CreateAcademicYearDto, @Req() req: any) {
    if (req.context?.branchId && !dto.branchId) {
      dto.branchId = req.context.branchId;
    }
    const data = await this.academicYearService.create(dto, req.userId);
    return { data, message: 'Academic year created successfully' };
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Settings.View)
  @ApiOperation({ summary: 'Get all academic years for a branch' })
  @ApiOkEnvelope(AcademicYearDto, {
    isArray: true,
    message: 'Academic years retrieved successfully',
  })
  @ApiStandardErrors()
  async findAll(@Query('branchId') branchId: string, @Req() req: any) {
    const targetBranchId = req.context?.branchId || branchId;

    const data = await this.academicYearService.findAll(targetBranchId);
    return { data, message: 'Academic years retrieved successfully' };
  }

  @Get('current')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
    UserRole.STUDENT,
    UserRole.PARENT,
  )
  @RequirePermission(PERMISSIONS.Settings.View)
  @ApiOperation({
    summary: 'Get current (selected) academic year',
    description:
      'Returns `data: null` when the branch has no selected year, rather than 404.',
  })
  @ApiOkEnvelope(AcademicYearDto, {
    nullable: true,
    message: 'Current academic year retrieved successfully',
  })
  @ApiStandardErrors()
  async findCurrent(@Query('branchId') branchId: string, @Req() req: any) {
    const targetBranchId = req.context?.branchId || branchId;

    const data = await this.academicYearService.findCurrent(targetBranchId);
    return { data, message: 'Current academic year retrieved successfully' };
  }

  // Declared after `current` so that literal path wins the match; a `:id`
  // route registered first would swallow `/academic-years/current`.
  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Settings.View)
  @ApiOperation({
    summary: 'Get academic year by ID',
    description:
      'Reads one year directly, without going through its branch list. Soft-deleted years are not found, matching the list.',
  })
  @ApiParam({ name: 'id', description: 'Academic Year UUID' })
  @ApiOkEnvelope(AcademicYearDto, {
    message: 'Academic year retrieved successfully',
  })
  @ApiStandardErrors(404)
  async findOne(@Param('id') id: string) {
    const data = await this.academicYearService.findById(id);
    return { data, message: 'Academic year retrieved successfully' };
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({ summary: 'Update academic year' })
  @ApiOkEnvelope(AcademicYearDto, {
    message: 'Academic year updated successfully',
  })
  @ApiStandardErrors(404)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAcademicYearDto,
    @Req() req: any,
  ) {
    const data = await this.academicYearService.update(id, dto, req.userId);
    return { data, message: 'Academic year updated successfully' };
  }

  @Patch(':id/activate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({
    summary: 'Activate academic year',
    description: 'Deactivates whichever year in the branch was active.',
  })
  @ApiEmptyEnvelope({ message: 'Academic year activated successfully' })
  @ApiStandardErrors(404)
  async activate(@Param('id') id: string) {
    return this.academicYearService.activate(id);
  }

  @Patch(':id/select')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({
    summary: 'Select academic year (set as current)',
    description: 'Deselects whichever year in the branch was selected.',
  })
  @ApiEmptyEnvelope({ message: 'Academic year selected successfully' })
  @ApiStandardErrors(404)
  async select(@Param('id') id: string) {
    return this.academicYearService.select(id);
  }

  @Patch(':id/lock')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({ summary: 'Lock academic year' })
  @ApiOkEnvelope(AcademicYearDto, {
    message: 'Academic year locked successfully',
  })
  @ApiStandardErrors(404)
  async lock(@Param('id') id: string) {
    const data = await this.academicYearService.lock(id);
    return { data, message: 'Academic year locked successfully' };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({ summary: 'Soft delete academic year' })
  @ApiEmptyEnvelope({ message: 'Academic year deleted successfully' })
  @ApiStandardErrors(404)
  async remove(@Param('id') id: string) {
    await this.academicYearService.softDelete(id);
    return { message: 'Academic year deleted successfully' };
  }
}
