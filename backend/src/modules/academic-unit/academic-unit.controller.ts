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
  @ApiOperation({ summary: 'Create an academic unit' })
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
  @ApiOperation({ summary: 'Get all academic units' })
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
  @ApiOperation({ summary: 'Get hierarchical academic unit tree' })
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
  @ApiOperation({ summary: 'Get academic unit by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.academicUnitService.getAcademicUnitById(id);
    return { data, message: 'Academic unit retrieved successfully' };
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Update academic unit details' })
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
  @ApiOperation({ summary: 'Move academic unit in hierarchy' })
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
  @ApiOperation({ summary: 'Toggle academic unit active status' })
  async toggleStatus(@Param('id') id: string, @Req() req: any) {
    const data = await this.academicUnitService.toggleAcademicUnitStatus(
      id,
      req.userId,
    );
    return { data, message: 'Academic unit status toggled successfully' };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Soft delete academic unit' })
  async remove(@Param('id') id: string, @Req() req: any) {
    const data = await this.academicUnitService.softDeleteAcademicUnit(
      id,
      req.userId,
    );
    return { data, message: 'Academic unit deleted successfully' };
  }
}
