import { Controller, Get, Post, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Roles } from '@/common/decorators/roles.decorator';
import { AllowDuringSetup } from '@/common/decorators/allow-during-setup.decorator';
import { UserRole } from '@/common/enums/role.enum';
import { AuthenticatedRequest } from '@/common/logger/request-context.middleware';
import { WorkspaceSetupService } from './workspace-setup.service';
import { WorkspaceSetupStatusDto } from './dto/workspace-setup-status.dto';

@ApiTags('Workspace Setup')
@ApiBearerAuth()
@Controller('v1/workspace/setup')
export class WorkspaceSetupController {
  constructor(private readonly setupService: WorkspaceSetupService) {}

  @Get('status')
  @AllowDuringSetup()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @ApiOperation({
    summary: 'Read the workspace bootstrap status',
    description:
      'Reports the current setup stage, which resources are missing, and which requests are permitted until setup completes.',
  })
  @ApiResponse({ status: 200, type: WorkspaceSetupStatusDto })
  async getStatus(): Promise<{
    data: WorkspaceSetupStatusDto;
    message: string;
  }> {
    const data = await this.setupService.getStatus();
    return { data, message: 'Workspace setup status retrieved successfully' };
  }

  @Post('complete')
  @AllowDuringSetup()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Mark the workspace initialized',
    description:
      'Completes bootstrap once an organization, branch and academic year all exist. From this point the tenant context headers apply as normal. Idempotent.',
  })
  @ApiResponse({ status: 201, type: WorkspaceSetupStatusDto })
  @ApiResponse({
    status: 409,
    description: 'SETUP_INCOMPLETE — a required resource is still missing.',
  })
  async complete(@Req() req: AuthenticatedRequest): Promise<{
    data: WorkspaceSetupStatusDto;
    message: string;
  }> {
    const data = await this.setupService.markInitialized(req.userId ?? null);
    return { data, message: 'Workspace marked initialized successfully' };
  }
}
