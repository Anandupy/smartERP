import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BranchService } from './branch.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/enums/role.enum';

@ApiTags('Branches')
@ApiBearerAuth()
@Controller('branches')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Create a new branch (Super/Org Admin only)' })
  async create(@Body() dto: CreateBranchDto, @Req() req: any) {
    const data = await this.branchService.createBranch(dto, req.userId);
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
    @Req() req: any,
  ) {
    const data = await this.branchService.updateBranch(id, dto, req.userId);
    return { data, message: 'Branch updated successfully' };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Soft delete branch (Super Admin only)' })
  async remove(@Param('id') id: string, @Req() req: any) {
    const data = await this.branchService.softDeleteBranch(id, req.userId);
    return { data, message: 'Branch deactivated successfully' };
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Toggle branch active status' })
  async toggleStatus(@Param('id') id: string, @Req() req: any) {
    const data = await this.branchService.toggleBranchStatus(id, req.userId);
    return { data, message: 'Branch status toggled successfully' };
  }
}
