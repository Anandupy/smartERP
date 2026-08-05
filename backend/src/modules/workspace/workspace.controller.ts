import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '@/common/decorators/roles.decorator';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { UserRole } from '@/common/enums/role.enum';
import { RoleType } from '@/generated/client';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import { RequestContextService } from '@/common/logger/request-context.service';
import { WorkspaceService, WorkspaceLayoutResponse } from './workspace.service';
import { WorkspaceConfigService } from './configuration/workspace-config.service';
import { UpsertWorkspaceConfigDto } from './configuration/dto/workspace-config.dto';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import {
  WorkspaceConfigurationDto,
  WorkspaceLayoutDto,
} from './dto/workspace-response.dto';

@ApiTags('Workspace')
@ApiBearerAuth()
@Controller('workspace')
export class WorkspaceController {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly configService: WorkspaceConfigService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get full workspace presentation layout',
    description:
      'Resolves activeContexts, client metadata, layered configuration, and authorized navigation tree',
  })
  @ApiOkEnvelope(WorkspaceLayoutDto, {
    message: 'Workspace layout resolved successfully',
  })
  @ApiStandardErrors()
  async getWorkspaceLayout(): Promise<{
    data: WorkspaceLayoutResponse;
    message: string;
  }> {
    const context = this.requestContext.getContext();
    const userId = context?.userId || '';
    const role = (context?.role as RoleType) || RoleType.STUDENT;

    const data = await this.workspaceService.getWorkspaceLayout(userId, role);

    return {
      data,
      message: 'Workspace layout resolved successfully',
    };
  }

  @Post('configuration')
  @Roles(UserRole.SUPER_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({
    summary: 'Upsert a workspace configuration layer (Super Admin only)',
  })
  @ApiCreatedEnvelope(WorkspaceConfigurationDto, {
    description:
      'Creates the layer, or merges into the existing one for the same scope.',
    message: 'Workspace configuration layer upserted successfully',
  })
  @ApiStandardErrors()
  async upsertConfiguration(
    @Body() dto: UpsertWorkspaceConfigDto,
  ): Promise<{ data: WorkspaceConfigurationDto; message: string }> {
    const data = await this.configService.upsertConfiguration(
      dto.scopeType,
      dto.scopeId || null,
      dto.navigationPreferences,
      dto.clientPreferences,
    );

    return {
      data,
      message: 'Workspace configuration layer upserted successfully',
    };
  }
}
