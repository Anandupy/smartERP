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
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { AllowDuringSetup } from '@/common/decorators/allow-during-setup.decorator';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import {
  BranchDto,
  BranchWithOrganizationDto,
} from './dto/branch-response.dto';

@ApiTags('Branches')
@ApiBearerAuth()
@Controller('branches')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Post()
  @AllowDuringSetup()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({ summary: 'Create a new branch (Super/Org Admin only)' })
  @ApiCreatedEnvelope(BranchDto, { message: 'Branch created successfully' })
  @ApiStandardErrors(404, 409)
  async create(@Body() dto: CreateBranchDto, @Req() req: any) {
    const data = await this.branchService.createBranch(dto, req.userId);
    return { data, message: 'Branch created successfully' };
  }

  @Get()
  @RequirePermission(PERMISSIONS.Settings.View)
  @ApiOperation({
    summary: 'Get all branches',
    description:
      'Scoped to the caller’s organization for every role except SUPER_ADMIN.',
  })
  @ApiOkEnvelope(BranchWithOrganizationDto, {
    isArray: true,
    message: 'Branches retrieved successfully',
  })
  @ApiStandardErrors()
  async findAll() {
    const data = await this.branchService.getAllBranches();
    return { data, message: 'Branches retrieved successfully' };
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.Settings.View)
  @ApiOperation({ summary: 'Get branch by ID' })
  @ApiOkEnvelope(BranchWithOrganizationDto, {
    message: 'Branch retrieved successfully',
  })
  @ApiStandardErrors(404)
  async findOne(@Param('id') id: string) {
    const data = await this.branchService.getBranchById(id);
    return { data, message: 'Branch retrieved successfully' };
  }

  @Get('organization/:orgId')
  @RequirePermission(PERMISSIONS.Settings.View)
  @ApiOperation({ summary: 'Get branches by organization' })
  @ApiOkEnvelope(BranchDto, {
    isArray: true,
    message: 'Organization branches retrieved successfully',
  })
  @ApiStandardErrors()
  async findByOrg(@Param('orgId') orgId: string) {
    const data = await this.branchService.getBranchesByOrganization(orgId);
    return { data, message: 'Organization branches retrieved successfully' };
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({
    summary: 'Update branch',
    description:
      'Accepts a partial body — send only the fields being changed. Omitted fields are left as they are.',
  })
  @ApiOkEnvelope(BranchDto, { message: 'Branch updated successfully' })
  @ApiStandardErrors(404, 409)
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
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({
    summary: 'Soft delete branch (Super Admin only)',
    description:
      'Marks the branch deleted and inactive, and returns the updated record.',
  })
  @ApiOkEnvelope(BranchDto, { message: 'Branch deactivated successfully' })
  @ApiStandardErrors(404)
  async remove(@Param('id') id: string, @Req() req: any) {
    const data = await this.branchService.softDeleteBranch(id, req.userId);
    return { data, message: 'Branch deactivated successfully' };
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({
    summary: 'Toggle branch active status',
    description:
      'Takes no body: it flips the current value rather than setting a target state, so it is **not idempotent** — sending it twice returns to where it started. Read the record first if the resulting state matters.',
  })
  @ApiOkEnvelope(BranchDto, { message: 'Branch status toggled successfully' })
  @ApiStandardErrors(404)
  async toggleStatus(@Param('id') id: string, @Req() req: any) {
    const data = await this.branchService.toggleBranchStatus(id, req.userId);
    return { data, message: 'Branch status toggled successfully' };
  }
}
