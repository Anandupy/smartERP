import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AuthorizationService } from '@/modules/authorization/authorization.service';
import { LoggerService } from '@/common/logger/logger.service';
import { MenuStatus, RoleType } from '@/generated/client';
import {
  NavigationTreeBuilder,
  TreeBuildResult,
} from '../builders/navigation-tree.builder';
import { NavigationCacheService } from './navigation-cache.service';

@Injectable()
export class NavigationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorizationService: AuthorizationService,
    private readonly treeBuilder: NavigationTreeBuilder,
    private readonly cacheService: NavigationCacheService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(NavigationService.name);
  }

  async resolveUserNavigation(
    userId: string,
    role: RoleType,
  ): Promise<TreeBuildResult> {
    // 1. Check Cache
    const cached = await this.cacheService.getUserNavigation(userId, role);
    if (cached) {
      this.logger.debug(`Navigation cache hit for user ${userId} (${role})`);
      return cached;
    }

    // 2. Fetch Active Modules
    const activeModules = await this.prisma.module.findMany({
      where: { isActive: true },
      select: { id: true, code: true },
    });

    if (activeModules.length === 0) {
      return { tree: [], totalVisibleMenus: 0, menuTreeDepth: 0 };
    }

    const activeModuleIds = activeModules.map((m) => m.id);

    // 3. Fetch Eligible Menus
    const candidateMenus = await this.prisma.menu.findMany({
      where: {
        moduleId: { in: activeModuleIds },
        status: { in: [MenuStatus.ACTIVE, MenuStatus.BETA] },
      },
      orderBy: { displayOrder: 'asc' },
    });

    // 4. Permission Filter Pipeline
    const visibleMenus: typeof candidateMenus = [];

    for (const menu of candidateMenus) {
      if (!menu.permissions || menu.permissions.length === 0) {
        visibleMenus.push(menu);
        continue;
      }

      const evalResult = await this.authorizationService.canUserAccess(
        userId,
        role,
        menu.permissions,
        menu.permissionMode as 'ALL' | 'ANY',
      );

      if (evalResult.allowed) {
        visibleMenus.push(menu);
      }
    }

    // 5. Build Tree
    const buildResult = this.treeBuilder.buildTree(visibleMenus);

    // 6. Populate Cache
    await this.cacheService.setUserNavigation(userId, role, buildResult);

    return buildResult;
  }
}
