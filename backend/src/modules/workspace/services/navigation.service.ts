import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AuthorizationService } from '@/modules/authorization/authorization.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { LoggerService } from '@/common/logger/logger.service';
import { RequestContextService } from '@/common/logger/request-context.service';
import { MenuStatus, RoleType } from '@/generated/client';
import {
  ModuleCreatedEvent,
  ModuleUpdatedEvent,
  MenuCreatedEvent,
  MenuUpdatedEvent,
  MenuDeletedEvent,
} from '@/common/events/workspace.events';

export interface NavigationMenuItem {
  id: string;
  code: string;
  moduleId: string;
  moduleCode: string;
  parentId: string | null;
  route: string;
  componentIdentifier: string | null;
  displayName: string;
  icon: string | null;
  tooltip: string | null;
  description: string | null;
  displayOrder: number;
  badge: string | null;
  searchKeywords: string[];
  helpUrl: string | null;
  documentationUrl: string | null;
  status: MenuStatus;
  children: NavigationMenuItem[];
}

@Injectable()
export class NavigationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorizationService: AuthorizationService,
    private readonly eventBus: EventBus,
    private readonly logger: LoggerService,
    private readonly requestContextService: RequestContextService,
  ) {
    this.logger.setContext(NavigationService.name);
  }

  /**
   * Menu Visibility Pipeline:
   * 1. Query active modules & non-disabled menus from database
   * 2. Filter out menus belonging to disabled modules
   * 3. Filter out menus with status HIDDEN or DISABLED
   * 4. Delegate permission evaluation to AuthorizationService.canUserAccess()
   * 5. Construct hierarchical parent -> children navigation tree
   */
  async resolveUserNavigationTree(
    userId: string,
    role: RoleType,
  ): Promise<NavigationMenuItem[]> {
    // 1. Fetch active modules
    const activeModules = await this.prisma.module.findMany({
      where: { isActive: true },
      select: { id: true, code: true },
    });

    const activeModuleIds = new Set(activeModules.map((m) => m.id));
    const moduleCodeMap = new Map(activeModules.map((m) => [m.id, m.code]));

    if (activeModuleIds.size === 0) {
      return [];
    }

    // 2. Fetch active/visible menus for active modules
    const rawMenus = await this.prisma.menu.findMany({
      where: {
        moduleId: { in: Array.from(activeModuleIds) },
        status: { notIn: [MenuStatus.DISABLED, MenuStatus.HIDDEN] },
      },
      orderBy: [{ displayOrder: 'asc' }, { displayName: 'asc' }],
    });

    // 3. Delegate permission evaluation to Authorization Platform
    const authorizedMenus: typeof rawMenus = [];
    for (const menu of rawMenus) {
      if (!menu.permissions || menu.permissions.length === 0) {
        // Public / Unrestricted navigation item
        authorizedMenus.push(menu);
      } else {
        const mode = (menu.permissionMode as 'ALL' | 'ANY') || 'ALL';
        const access = await this.authorizationService.canUserAccess(
          userId,
          role,
          menu.permissions,
          mode,
        );
        if (access.allowed) {
          authorizedMenus.push(menu);
        }
      }
    }

    // 4. Build Navigation Hierarchy Tree
    return this.buildNavigationTree(authorizedMenus, moduleCodeMap);
  }

  private buildNavigationTree(
    menus: any[],
    moduleCodeMap: Map<string, string>,
  ): NavigationMenuItem[] {
    const itemMap = new Map<string, NavigationMenuItem>();
    const rootNodes: NavigationMenuItem[] = [];

    // Map database records to NavigationMenuItem objects
    for (const m of menus) {
      const item: NavigationMenuItem = {
        id: m.id,
        code: m.code,
        moduleId: m.moduleId,
        moduleCode: moduleCodeMap.get(m.moduleId) || '',
        parentId: m.parentId,
        route: m.route,
        componentIdentifier: m.componentIdentifier,
        displayName: m.displayName,
        icon: m.icon,
        tooltip: m.tooltip,
        description: m.description,
        displayOrder: m.displayOrder,
        badge: m.badge,
        searchKeywords: m.searchKeywords || [],
        helpUrl: m.helpUrl,
        documentationUrl: m.documentationUrl,
        status: m.status as MenuStatus,
        children: [],
      };
      itemMap.set(m.id, item);
    }

    // Connect parents and children
    for (const item of itemMap.values()) {
      if (item.parentId && itemMap.has(item.parentId)) {
        itemMap.get(item.parentId)!.children.push(item);
      } else {
        rootNodes.push(item);
      }
    }

    // Sort root and children by displayOrder
    const sortTree = (nodes: NavigationMenuItem[]) => {
      nodes.sort((a, b) => a.displayOrder - b.displayOrder);
      for (const node of nodes) {
        if (node.children.length > 0) {
          sortTree(node.children);
        }
      }
    };

    sortTree(rootNodes);
    return rootNodes;
  }

  // --- Administration Methods ---

  async createModule(dto: {
    code: string;
    name: string;
    description?: string;
    icon?: string;
    displayOrder?: number;
  }) {
    const context = this.requestContextService.getContext();
    const performedBy = context?.userId || 'SYSTEM';

    const existing = await this.prisma.module.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(
        `Module with code "${dto.code}" already exists`,
      );
    }

    const module = await this.prisma.module.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        icon: dto.icon,
        displayOrder: dto.displayOrder ?? 0,
      },
    });

    await this.eventBus.publish(
      new ModuleCreatedEvent({
        moduleId: module.id,
        code: module.code,
        name: module.name,
        performedBy,
      }),
    );

    return module;
  }

  async updateModule(
    id: string,
    dto: {
      name?: string;
      description?: string;
      icon?: string;
      displayOrder?: number;
      isActive?: boolean;
    },
  ) {
    const context = this.requestContextService.getContext();
    const performedBy = context?.userId || 'SYSTEM';

    const existing = await this.prisma.module.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Module "${id}" not found`);
    }

    const updated = await this.prisma.module.update({
      where: { id },
      data: dto,
    });

    await this.eventBus.publish(
      new ModuleUpdatedEvent({
        moduleId: updated.id,
        code: updated.code,
        previousState: existing,
        newState: updated,
        performedBy,
      }),
    );

    return updated;
  }

  async createMenu(dto: {
    code: string;
    moduleId: string;
    parentId?: string;
    route: string;
    componentIdentifier?: string;
    permissions?: string[];
    permissionMode?: 'ALL' | 'ANY';
    displayName: string;
    icon?: string;
    tooltip?: string;
    description?: string;
    displayOrder?: number;
    badge?: string;
    searchKeywords?: string[];
    helpUrl?: string;
    documentationUrl?: string;
    status?: MenuStatus;
  }) {
    const context = this.requestContextService.getContext();
    const performedBy = context?.userId || 'SYSTEM';

    const existing = await this.prisma.menu.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(
        `Menu with code "${dto.code}" already exists`,
      );
    }

    const menu = await this.prisma.menu.create({
      data: {
        code: dto.code,
        moduleId: dto.moduleId,
        parentId: dto.parentId || null,
        route: dto.route,
        componentIdentifier: dto.componentIdentifier,
        permissions: dto.permissions || [],
        permissionMode: dto.permissionMode || 'ALL',
        displayName: dto.displayName,
        icon: dto.icon,
        tooltip: dto.tooltip,
        description: dto.description,
        displayOrder: dto.displayOrder ?? 0,
        badge: dto.badge,
        searchKeywords: dto.searchKeywords || [],
        helpUrl: dto.helpUrl,
        documentationUrl: dto.documentationUrl,
        status: dto.status || MenuStatus.ACTIVE,
      },
    });

    await this.eventBus.publish(
      new MenuCreatedEvent({
        menuId: menu.id,
        code: menu.code,
        displayName: menu.displayName,
        route: menu.route,
        performedBy,
      }),
    );

    return menu;
  }

  async updateMenu(
    id: string,
    dto: {
      displayName?: string;
      icon?: string;
      tooltip?: string;
      description?: string;
      displayOrder?: number;
      badge?: string;
      searchKeywords?: string[];
      helpUrl?: string;
      documentationUrl?: string;
      status?: MenuStatus;
      route?: string;
      permissions?: string[];
      permissionMode?: 'ALL' | 'ANY';
    },
  ) {
    const context = this.requestContextService.getContext();
    const performedBy = context?.userId || 'SYSTEM';

    const existing = await this.prisma.menu.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Menu "${id}" not found`);
    }

    const updated = await this.prisma.menu.update({
      where: { id },
      data: dto,
    });

    await this.eventBus.publish(
      new MenuUpdatedEvent({
        menuId: updated.id,
        code: updated.code,
        previousState: existing,
        newState: updated,
        performedBy,
      }),
    );

    return updated;
  }

  async deleteMenu(id: string) {
    const context = this.requestContextService.getContext();
    const performedBy = context?.userId || 'SYSTEM';

    const existing = await this.prisma.menu.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Menu "${id}" not found`);
    }

    await this.prisma.menu.delete({ where: { id } });

    await this.eventBus.publish(
      new MenuDeletedEvent({
        menuId: id,
        code: existing.code,
        performedBy,
      }),
    );

    return { message: `Menu "${existing.code}" deleted successfully` };
  }
}
