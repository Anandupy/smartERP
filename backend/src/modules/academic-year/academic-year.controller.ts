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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AcademicYearService } from './academic-year.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/enums/role.enum';

@ApiTags('Academic Years')
@ApiBearerAuth()
@Controller('academic-years')
export class AcademicYearController {
  constructor(private readonly academicYearService: AcademicYearService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Create academic year' })
  async create(@Body() dto: CreateAcademicYearDto, @Req() req: any) {
    // If not super admin, enforce branchId from context
    if (req.context?.role !== UserRole.SUPER_ADMIN && req.context?.branchId) {
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
  @ApiOperation({ summary: 'Get all academic years for a branch' })
  async findAll(@Query('branchId') branchId: string, @Req() req: any) {
    // If not super admin, enforce branchId from context
    const targetBranchId =
      req.context?.role !== UserRole.SUPER_ADMIN && req.context?.branchId
        ? req.context.branchId
        : branchId;

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
  @ApiOperation({ summary: 'Get current (selected) academic year' })
  async findCurrent(@Query('branchId') branchId: string, @Req() req: any) {
    // If not super admin, enforce branchId from context
    const targetBranchId =
      req.context?.role !== UserRole.SUPER_ADMIN && req.context?.branchId
        ? req.context.branchId
        : branchId;

    const data = await this.academicYearService.findCurrent(targetBranchId);
    return { data, message: 'Current academic year retrieved successfully' };
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Update academic year' })
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
  @ApiOperation({ summary: 'Activate academic year' })
  async activate(@Param('id') id: string) {
    return this.academicYearService.activate(id);
  }

  @Patch(':id/select')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Select academic year (set as current)' })
  async select(@Param('id') id: string) {
    return this.academicYearService.select(id);
  }

  @Patch(':id/lock')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Lock academic year' })
  async lock(@Param('id') id: string) {
    const data = await this.academicYearService.lock(id);
    return { data, message: 'Academic year locked successfully' };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Soft delete academic year' })
  async remove(@Param('id') id: string) {
    await this.academicYearService.softDelete(id);
    return { message: 'Academic year deleted successfully' };
  }
}
