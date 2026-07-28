import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { WorkspaceService } from './workspace.service';
import { NavigationService } from './services/navigation.service';
import { WorkspaceConfigService } from './services/workspace-config.service';
import { CreateModuleDto, UpdateModuleDto } from './dto/module.dto';
import { CreateMenuDto, UpdateMenuDto } from './dto/menu.dto';
import { UpsertWorkspaceConfigDto } from './dto/workspace-config.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/enums/role.enum';
import { RoleType } from '@/generated/client';

@ApiTags('Workspace Platform')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-client-app',
  required: false,
  description: 'Client application identification header (e.g. campusflow-web)',
})
@ApiHeader({
  name: 'x-client-version',
  required: false,
  description: 'Client application version (e.g. 1.0.0)',
})
@ApiHeader({
  name: 'x-platform',
  required: false,
  description: 'Client platform header: WEB, MOBILE, DESKTOP',
})
@Controller('workspace')
export class WorkspaceController {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly navigationService: NavigationService,
    private readonly configService: WorkspaceConfigService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Orchestrate and resolve workspace layout, navigation tree, active contexts, and configurations',
  })
  async getWorkspace(@Req() req: any) {
    const userId = req.context?.userId || req.user?.id || req.user?.sub;
    const role = (req.context?.role || req.user?.role) as RoleType;

    if (!userId || !role) {
      throw new ForbiddenException('User context missing or unauthenticated');
    }

    const data = await this.workspaceService.getWorkspaceLayout(userId, role);
    return { data, message: 'Workspace layout resolved successfully' };
  }

  // --- Administration Endpoints (Super Admin Only) ---

  @Post('modules')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Create a new navigation module (Super Admin only)',
  })
  async createModule(@Body() dto: CreateModuleDto) {
    const data = await this.navigationService.createModule(dto);
    return { data, message: 'Navigation module created successfully' };
  }

  @Patch('modules/:id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a navigation module (Super Admin only)' })
  async updateModule(@Param('id') id: string, @Body() dto: UpdateModuleDto) {
    const data = await this.navigationService.updateModule(id, dto);
    return { data, message: 'Navigation module updated successfully' };
  }

  @Post('menus')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Create a new navigation menu item (Super Admin only)',
  })
  async createMenu(@Body() dto: CreateMenuDto) {
    const data = await this.navigationService.createMenu(dto);
    return { data, message: 'Navigation menu created successfully' };
  }

  @Patch('menus/:id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a navigation menu item (Super Admin only)' })
  async updateMenu(@Param('id') id: string, @Body() dto: UpdateMenuDto) {
    const data = await this.navigationService.updateMenu(id, dto);
    return { data, message: 'Navigation menu updated successfully' };
  }

  @Delete('menus/:id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a navigation menu item (Super Admin only)' })
  async deleteMenu(@Param('id') id: string) {
    const data = await this.navigationService.deleteMenu(id);
    return data;
  }

  @Post('configurations')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Upsert a workspace configuration layer (Super Admin only)',
  })
  async upsertConfig(@Body() dto: UpsertWorkspaceConfigDto) {
    const data = await this.configService.upsertConfiguration(
      dto.scopeType,
      dto.scopeId || null,
      dto.navigationPreferences,
      dto.clientPreferences,
    );
    return { data, message: 'Workspace configuration saved successfully' };
  }
}
