import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { BranchService } from './branch.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { UserRole } from '@/common/enums/role.enum';

@ApiTags('Branches')
@ApiHeader({ name: 'x-role', description: 'User role for simulation', required: true })
@ApiHeader({ name: 'x-user-id', description: 'User ID for audit trail', required: false })
@Controller('branches')
@UseGuards(RolesGuard)
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Create a new branch (Super/Org Admin only)' })
  async create(@Body() dto: CreateBranchDto, @Headers('x-user-id') userId?: string) {
    const data = await this.branchService.createBranch(dto, userId);
    return { data, message: 'Branch created successfully' };
  }

  @Get()
  @ApiOperation({ summary: 'Get all branches' })
  async findAll() {
    const data = await this.branchService.getAllBranches();
    return { data, message: 'Branches retrieved successfully' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get branch by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.branchService.getBranchById(id);
    return { data, message: 'Branch retrieved successfully' };
  }

  @Get('organization/:orgId')
  @ApiOperation({ summary: 'Get branches by organization' })
  async findByOrg(@Param('orgId') orgId: string) {
    const data = await this.branchService.getBranchesByOrganization(orgId);
    return { data, message: 'Organization branches retrieved successfully' };
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Update branch' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
    @Headers('x-user-id') userId?: string,
  ) {
    const data = await this.branchService.updateBranch(id, dto, userId);
    return { data, message: 'Branch updated successfully' };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Soft delete branch (Super Admin only)' })
  async remove(@Param('id') id: string, @Headers('x-user-id') userId?: string) {
    const data = await this.branchService.softDeleteBranch(id, userId);
    return { data, message: 'Branch deactivated successfully' };
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Toggle branch active status' })
  async toggleStatus(@Param('id') id: string, @Headers('x-user-id') userId?: string) {
    const data = await this.branchService.toggleBranchStatus(id, userId);
    return { data, message: 'Branch status toggled successfully' };
  }
}
