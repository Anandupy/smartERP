import { Injectable, UnauthorizedException } from '@nestjs/common';
import { NavigationService } from './services/navigation.service';
import { WorkspaceConfigService } from './services/workspace-config.service';
import { RequestContextService } from '@/common/logger/request-context.service';
import { LoggerService } from '@/common/logger/logger.service';
import { RoleType } from '@/generated/client';

export interface WorkspaceResponse {
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
  configuration: Record<string, any>;
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
    private readonly requestContextService: RequestContextService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(WorkspaceService.name);
  }

  /**
   * Presentation Orchestration Endpoint Handler for GET /v1/workspace
   * Consumes authenticated user context & Authorization Platform
   */
  async getWorkspaceLayout(
    userId: string,
    role: RoleType,
  ): Promise<WorkspaceResponse> {
    if (!userId || !role) {
      throw new UnauthorizedException(
        'User context missing or unauthenticated',
      );
    }

    const context = this.requestContextService.getContext();

    const organizationId = context?.organizationId || null;
    const branchId = context?.branchId || null;
    const academicYearId = context?.academicYearId || null;

    const clientApp = context?.clientApp || 'campusflow-web';
    const clientVersion = context?.clientVersion || '1.0.0';
    const platform = context?.platform || 'WEB';

    // 1. Resolve Layered Workspace Configuration
    const configuration = await this.configService.resolveConfiguration(
      organizationId,
      branchId,
      role,
      userId,
    );

    // 2. Resolve Navigation Tree via Visibility Pipeline & Authorization Platform
    const navigationTree =
      await this.navigationService.resolveUserNavigationTree(userId, role);

    // Calculate metadata
    const countVisibleMenus = (nodes: any[]): number => {
      let count = nodes.length;
      for (const node of nodes) {
        if (node.children && node.children.length > 0) {
          count += countVisibleMenus(node.children);
        }
      }
      return count;
    };

    const getTreeDepth = (nodes: any[]): number => {
      if (!nodes || nodes.length === 0) return 0;
      let maxDepth = 0;
      for (const node of nodes) {
        if (node.children && node.children.length > 0) {
          maxDepth = Math.max(maxDepth, getTreeDepth(node.children));
        }
      }
      return 1 + maxDepth;
    };

    const totalVisibleMenus = countVisibleMenus(navigationTree);
    const menuTreeDepth = getTreeDepth(navigationTree);

    this.logger.log(
      `Resolved workspace layout for user=${userId} (Role: ${role}, Platform: ${platform}, Visible Menus: ${totalVisibleMenus})`,
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
      configuration,
      navigation: navigationTree,
      metadata: {
        resolvedAt: new Date().toISOString(),
        totalVisibleMenus,
        menuTreeDepth,
      },
    };
  }
}
