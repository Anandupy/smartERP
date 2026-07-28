import { Injectable, UnauthorizedException } from '@nestjs/common';
import { RequestContextService } from '@/common/logger/request-context.service';
import { LoggerService } from '@/common/logger/logger.service';
import { RoleType } from '@/generated/client';
import { NavigationService } from './navigation/services/navigation.service';
import { WorkspaceConfigService } from './configuration/workspace-config.service';

export interface WorkspaceLayoutResponse {
  activeContexts: {
    organizationId: string | null;
    branchId: string | null;
    academicYearId: string | null;
  };
  client: {
    clientApp: string;
    clientVersion: string;
    platform: string;
  };
  configuration: {
    navigationPreferences: Record<string, any>;
    clientPreferences: Record<string, any>;
  };
  navigation: any[];
  metadata: {
    resolvedAt: string;
    totalVisibleMenus: number;
    menuTreeDepth: number;
  };
}

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly navigationService: NavigationService,
    private readonly configService: WorkspaceConfigService,
    private readonly requestContext: RequestContextService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(WorkspaceService.name);
  }

  async getWorkspaceLayout(
    userId: string,
    role: RoleType,
  ): Promise<WorkspaceLayoutResponse> {
    const context = this.requestContext.getContext();

    if (!userId || !role) {
      throw new UnauthorizedException(
        'User context missing or unauthenticated',
      );
    }

    const organizationId = context?.organizationId || null;
    const branchId = context?.branchId || null;
    const academicYearId = context?.academicYearId || null;

    const clientApp = context?.clientApp || 'campusflow-web';
    const clientVersion = context?.clientVersion || '1.0.0';
    const platform = context?.platform || 'WEB';

    // 1. Resolve Layered Configuration
    const resolvedConfig = await this.configService.resolveConfiguration(
      organizationId,
      branchId,
      role,
      userId,
    );

    // 2. Resolve Navigation Tree
    const navBuildResult = await this.navigationService.resolveUserNavigation(
      userId,
      role,
    );

    this.logger.log(
      `Resolved workspace layout for user ${userId} (${role}) on ${platform}`,
    );

    return {
      activeContexts: {
        organizationId,
        branchId,
        academicYearId,
      },
      client: {
        clientApp,
        clientVersion,
        platform,
      },
      configuration: resolvedConfig,
      navigation: navBuildResult.tree,
      metadata: {
        resolvedAt: new Date().toISOString(),
        totalVisibleMenus: navBuildResult.totalVisibleMenus,
        menuTreeDepth: navBuildResult.menuTreeDepth,
      },
    };
  }
}
