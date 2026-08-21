import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseEnumPipe,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '@/common/decorators/roles.decorator';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { UserRole } from '@/common/enums/role.enum';
import { RoleType } from '@/generated/client';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import { RequestContextService } from '@/common/logger/request-context.service';
import { WorkspaceScopeType } from '@/generated/client';
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

  @Get('configuration/:scopeType')
  @Roles(UserRole.SUPER_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({
    summary: 'Read a single workspace configuration layer (Super Admin only)',
    description:
      'Looks a layer up by the exact scopeType/scopeId key POST /workspace/configuration upserts against — not the merged config a user in that scope effectively sees. Pass scopeId as a query parameter; omit it for the PRODUCT layer, which has none.',
  })
  @ApiOkEnvelope(WorkspaceConfigurationDto, {
    message: 'Workspace configuration layer retrieved successfully',
  })
  @ApiStandardErrors(404)
  async getConfiguration(
    @Param('scopeType', new ParseEnumPipe(WorkspaceScopeType))
    scopeType: WorkspaceScopeType,
    @Query('scopeId') scopeId?: string,
  ): Promise<{ data: WorkspaceConfigurationDto; message: string }> {
    const config = await this.configService.getConfiguration(
      scopeType,
      scopeId || null,
    );

    if (!config) {
      throw new NotFoundException(
        'No configuration layer exists for this scope',
      );
    }

    return {
      data: config,
      message: 'Workspace configuration layer retrieved successfully',
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
