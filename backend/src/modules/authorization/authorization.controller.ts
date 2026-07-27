import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AuthorizationService } from './authorization.service';
import { PermissionCatalogService } from './permission-catalog.service';
import { PermissionAssignmentService } from './permission-assignment.service';
import { AssignRolePermissionsDto } from './dto/assign-role-permissions.dto';
import { SetUserPermissionOverrideDto } from './dto/user-permission-override.dto';
import { QueryPermissionsDto } from './dto/permission-query.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/enums/role.enum';
import { RoleType } from '@prisma/client';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PERMISSIONS } from '@/common/constants/permission.constants';

@ApiTags('Authorization')
@ApiBearerAuth()
@Controller('authorization')
export class AuthorizationController {
  constructor(
    private readonly authorizationService: AuthorizationService,
    private readonly catalogService: PermissionCatalogService,
    private readonly assignmentService: PermissionAssignmentService,
  ) {}

  @Get('categories')
  @RequirePermission(PERMISSIONS.Settings.View)
  @ApiOperation({ summary: 'List all active permission categories' })
  async getCategories() {
    return this.catalogService.getCategories();
  }

  @Get('permissions')
  @RequirePermission(PERMISSIONS.Settings.View)
  @ApiOperation({ summary: 'List system permissions with category details' })
  async getPermissions(@Query() query: QueryPermissionsDto) {
    return this.catalogService.getPermissions(query.categoryId);
  }

  @Get('permissions/:id')
  @RequirePermission(PERMISSIONS.Settings.View)
  @ApiOperation({ summary: 'Get permission details by ID' })
  @ApiParam({ name: 'id', description: 'Permission UUID' })
  async getPermissionById(@Param('id') id: string) {
    return this.catalogService.getPermissionById(id);
  }

  @Get('roles/:role/permissions')
  @RequirePermission(PERMISSIONS.Settings.View)
  @ApiOperation({ summary: 'Get permissions assigned to a specific role' })
  @ApiParam({ name: 'role', enum: RoleType })
  async getRolePermissions(@Param('role') role: RoleType) {
    return this.assignmentService.getRolePermissions(role);
  }

  @Post('roles/:role/permissions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({ summary: 'Assign or synchronize permissions for a role' })
  @ApiParam({ name: 'role', enum: RoleType })
  async assignRolePermissions(
    @Param('role') role: RoleType,
    @Body() dto: AssignRolePermissionsDto,
    @Req() req: any,
  ) {
    const updatedBy = req.context?.userId || req.user?.id;
    return this.assignmentService.assignPermissionsToRole(
      role,
      dto.permissionIds,
      updatedBy,
    );
  }

  @Get('users/:userId/overrides')
  @RequirePermission(PERMISSIONS.Settings.View)
  @ApiOperation({ summary: 'Get direct permission overrides for a user' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  async getUserOverrides(@Param('userId') userId: string) {
    return this.assignmentService.getUserOverrides(userId);
  }

  @Post('users/:userId/overrides')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({
    summary: 'Set direct permission override for a user (GRANT or DENY)',
  })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  async setUserOverride(
    @Param('userId') userId: string,
    @Body() dto: SetUserPermissionOverrideDto,
    @Req() req: any,
  ) {
    const performedBy = req.context?.userId || req.user?.id;
    return this.assignmentService.setUserOverride(
      userId,
      dto.permissionId,
      dto.type,
      dto.reason,
      performedBy,
    );
  }

  @Delete('users/:userId/overrides/:permissionId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({ summary: 'Remove a direct user permission override' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiParam({ name: 'permissionId', description: 'Permission UUID' })
  async removeUserOverride(
    @Param('userId') userId: string,
    @Param('permissionId') permissionId: string,
    @Req() req: any,
  ) {
    const removedBy = req.context?.userId || req.user?.id;
    return this.assignmentService.removeUserOverride(
      userId,
      permissionId,
      removedBy,
    );
  }

  @Get('me/effective-permissions')
  @ApiOperation({
    summary: 'Get effective resolved permissions for the active logged-in user',
  })
  async getMyEffectivePermissions(@Req() req: any) {
    const userId = req.context?.userId || req.user?.id || req.user?.sub;
    const role = (req.context?.role || req.user?.role) as RoleType;

    if (!userId || !role) {
      throw new ForbiddenException('User context missing or unauthenticated');
    }

    return this.authorizationService.getUserEffectivePermissions(userId, role);
  }
}
