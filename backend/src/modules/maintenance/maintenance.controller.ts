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
import { MaintenanceService } from './maintenance.service';
import { CreateMaintenanceRuleDto } from './dto/create-maintenance-rule.dto';
import { UpdateMaintenanceRuleDto } from './dto/update-maintenance-rule.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/enums/role.enum';
import { Public } from '@/common/decorators/public.decorator';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PERMISSIONS } from '@/common/constants/permission.constants';

@ApiTags('Maintenance Rules')
@Controller('maintenance-rules')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Public()
  @Get('active/status')
  @ApiOperation({
    summary:
      'Check current resolved active maintenance status matching request context',
  })
  async getActiveStatus(@Req() req: any) {
    const requestContext = req.context || {};
    const userId =
      requestContext.userId || req.user?.id || req.user?.sub || null;
    const role = requestContext.role || req.user?.role || null;
    const organizationId =
      requestContext.organizationId || req.user?.organizationId || null;
    const branchId =
      requestContext.branchId ||
      req.headers['x-branch-id'] ||
      req.headers['X-Branch-Id'] ||
      req.user?.branchId ||
      null;

    const rule = await this.maintenanceService.resolveActiveRule(
      { userId, role, organizationId, branchId },
      req.path || req.url,
    );

    if (!rule) {
      return {
        data: { maintenanceEnabled: false },
        message: 'System is operating normally',
      };
    }

    return {
      data: {
        maintenanceEnabled: true,
        maintenanceScope: rule.scopeType,
        scopeType: rule.scopeType,
        scopeId: rule.scopeId,
        title: rule.title || 'System Maintenance',
        message: rule.shortMessage || 'The system is under maintenance.',
        description: rule.description || '',
        reason: rule.reason || '',
        estimatedCompletion: rule.estimatedCompletion || null,
        supportContact: rule.supportContact || '',
        maintenanceWindow: rule.maintenanceWindow || '',
        readOnly: !rule.allowWriteApis,
        allowedOperations: rule.allowWriteApis
          ? ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE']
          : ['GET', 'HEAD', 'OPTIONS'],
      },
      message: 'Active maintenance rule resolved',
    };
  }

  @Post()
  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @RequirePermission(PERMISSIONS.System.Maintenance)
  @ApiOperation({ summary: 'Create a new maintenance rule (SUPER_ADMIN only)' })
  async create(@Body() dto: CreateMaintenanceRuleDto, @Req() req: any) {
    const data = await this.maintenanceService.createRule(dto, req.userId);
    return { data, message: 'Maintenance rule created successfully' };
  }

  @Get()
  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @RequirePermission(PERMISSIONS.System.View)
  @ApiOperation({ summary: 'List all maintenance rules (SUPER_ADMIN only)' })
  async findAll() {
    const data = await this.maintenanceService.listRules();
    return { data, message: 'Maintenance rules retrieved successfully' };
  }

  @Get(':id')
  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @RequirePermission(PERMISSIONS.System.View)
  @ApiOperation({
    summary: 'Get details of a maintenance rule by ID (SUPER_ADMIN only)',
  })
  async findOne(@Param('id') id: string) {
    const data = await this.maintenanceService.getRule(id);
    return { data, message: 'Maintenance rule retrieved successfully' };
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @RequirePermission(PERMISSIONS.System.Maintenance)
  @ApiOperation({ summary: 'Update a maintenance rule (SUPER_ADMIN only)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceRuleDto,
    @Req() req: any,
  ) {
    const data = await this.maintenanceService.updateRule(id, dto, req.userId);
    return { data, message: 'Maintenance rule updated successfully' };
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @RequirePermission(PERMISSIONS.System.Maintenance)
  @ApiOperation({ summary: 'Delete a maintenance rule (SUPER_ADMIN only)' })
  async remove(@Param('id') id: string) {
    const data = await this.maintenanceService.deleteRule(id);
    return { message: data.message };
  }
}
