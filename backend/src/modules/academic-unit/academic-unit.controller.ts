import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { AcademicUnitService } from './academic-unit.service';
import { CreateAcademicUnitDto } from './dto/create-academic-unit.dto';
import { UpdateAcademicUnitDto } from './dto/update-academic-unit.dto';
import { MoveAcademicUnitDto } from './dto/move-academic-unit.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RequireBranch } from '@/common/decorators/branch.decorator';
import { RequireAcademicYear } from '@/common/decorators/academic-year.decorator';
import { UserRole } from '@/common/enums/role.enum';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import {
  AcademicUnitDetailDto,
  AcademicUnitDto,
  AcademicUnitTreeNodeDto,
} from './dto/academic-unit-response.dto';

@ApiTags('Academic Units')
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
@Controller('academic-units')
export class AcademicUnitController {
  constructor(private readonly academicUnitService: AcademicUnitService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({ summary: 'Create an academic unit' })
  @ApiCreatedEnvelope(AcademicUnitDto, {
    message: 'Academic unit created successfully',
  })
  @ApiStandardErrors(404, 409)
  async create(@Body() createDto: CreateAcademicUnitDto, @Req() req: any) {
    if (req.context?.role !== UserRole.SUPER_ADMIN && req.context?.branchId) {
      createDto.branchId = req.context.branchId;
    }
    if (req.context?.academicYearId && !createDto.academicYearId) {
      createDto.academicYearId = req.context.academicYearId;
    }
    const data = await this.academicUnitService.createAcademicUnit(
      createDto,
      req.userId,
    );
    return { data, message: 'Academic unit created successfully' };
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Settings.View)
  @ApiOperation({
    summary: 'Get all academic units',
    description: 'Flat list ordered by level, then display order, then name.',
  })
  @ApiOkEnvelope(AcademicUnitDto, {
    isArray: true,
    message: 'Academic units retrieved successfully',
  })
  @ApiStandardErrors()
  async findAll(
    @Query('branchId') branchId: string,
    @Query('academicYearId') academicYearId: string,
    @Req() req: any,
  ) {
    const targetBranchId =
      req.context?.role !== UserRole.SUPER_ADMIN && req.context?.branchId
        ? req.context.branchId
        : branchId || req.context?.branchId;

    const targetAcademicYearId = academicYearId || req.context?.academicYearId;

    const data = await this.academicUnitService.getAllAcademicUnits(
      targetBranchId,
      targetAcademicYearId,
    );
    return { data, message: 'Academic units retrieved successfully' };
  }

  @Get('tree')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Settings.View)
  @ApiOperation({
    summary: 'Get hierarchical academic unit tree',
    description:
      'The same units as `GET /academic-units`, nested under their parents instead of flat.',
  })
  @ApiOkEnvelope(AcademicUnitTreeNodeDto, {
    isArray: true,
    message: 'Academic tree retrieved successfully',
  })
  @ApiStandardErrors()
  async getTree(
    @Query('branchId') branchId: string,
    @Query('academicYearId') academicYearId: string,
    @Req() req: any,
  ) {
    const targetBranchId =
      req.context?.role !== UserRole.SUPER_ADMIN && req.context?.branchId
        ? req.context.branchId
        : branchId || req.context?.branchId;

    const targetAcademicYearId = academicYearId || req.context?.academicYearId;

    const data = await this.academicUnitService.getAcademicTree(
      targetBranchId,
      targetAcademicYearId,
    );
    return { data, message: 'Academic tree retrieved successfully' };
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Settings.View)
  @ApiOperation({ summary: 'Get academic unit by ID' })
  @ApiOkEnvelope(AcademicUnitDetailDto, {
    message: 'Academic unit retrieved successfully',
  })
  @ApiStandardErrors(404)
  async findOne(@Param('id') id: string) {
    const data = await this.academicUnitService.getAcademicUnitById(id);
    return { data, message: 'Academic unit retrieved successfully' };
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({
    summary: 'Update academic unit details',
    description:
      'Accepts a partial body — send only the fields being changed. Omitted fields are left as they are. `parentId` is accepted here, but a re-parent should go through PATCH /:id/move — that is the endpoint which recalculates `level`.',
  })
  @ApiOkEnvelope(AcademicUnitDto, {
    message: 'Academic unit updated successfully',
  })
  @ApiStandardErrors(404, 409)
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAcademicUnitDto,
    @Req() req: any,
  ) {
    const data = await this.academicUnitService.updateAcademicUnit(
      id,
      updateDto,
      req.userId,
    );
    return { data, message: 'Academic unit updated successfully' };
  }

  @Patch(':id/move')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({
    summary: 'Move academic unit in hierarchy',
    description: 'Rejected with 400 when the move would create a cycle.',
  })
  @ApiOkEnvelope(AcademicUnitDto, {
    message: 'Academic unit moved successfully',
  })
  @ApiStandardErrors(404, 409)
  async move(
    @Param('id') id: string,
    @Body() moveDto: MoveAcademicUnitDto,
    @Req() req: any,
  ) {
    const data = await this.academicUnitService.moveAcademicUnit(
      id,
      moveDto,
      req.userId,
    );
    return { data, message: 'Academic unit moved successfully' };
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({
    summary: 'Toggle academic unit active status',
    description:
      'Takes no body: it flips the current value rather than setting a target state, so it is **not idempotent** — sending it twice returns to where it started. Read the record first if the resulting state matters. PATCH /:id also accepts `isActive` and does set a target state; use that when the desired value is known.',
  })
  @ApiOkEnvelope(AcademicUnitDto, {
    message: 'Academic unit status toggled successfully',
  })
  @ApiStandardErrors(404)
  async toggleStatus(@Param('id') id: string, @Req() req: any) {
    const data = await this.academicUnitService.toggleAcademicUnitStatus(
      id,
      req.userId,
    );
    return { data, message: 'Academic unit status toggled successfully' };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({
    summary: 'Soft delete academic unit',
    description:
      'Rejected with 400 while the unit still has active child units.',
  })
  @ApiOkEnvelope(AcademicUnitDto, {
    message: 'Academic unit deleted successfully',
  })
  @ApiStandardErrors(404)
  async remove(@Param('id') id: string, @Req() req: any) {
    const data = await this.academicUnitService.softDeleteAcademicUnit(
      id,
      req.userId,
    );
    return { data, message: 'Academic unit deleted successfully' };
  }
}
