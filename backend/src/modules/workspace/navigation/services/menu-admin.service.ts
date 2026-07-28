import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { LoggerService } from '@/common/logger/logger.service';
import { RequestContextService } from '@/common/logger/request-context.service';
import { MenuStatus } from '@/generated/client';
import {
  MenuCreatedEvent,
  MenuUpdatedEvent,
  MenuDeletedEvent,
} from '@/common/events/workspace.events';
import { CreateMenuDto } from '../dto/menu/create-menu.dto';
import { UpdateMenuDto } from '../dto/menu/update-menu.dto';
import { MoveMenuDto } from '../dto/menu/move-menu.dto';
import { ReorderMenusDto } from '../dto/menu/reorder-menu.dto';
import { UpdateMenuStatusDto } from '../dto/menu/menu-status.dto';
import { MenuHierarchyValidator } from '../validators/menu-hierarchy.validator';
import { NavigationCacheService } from './navigation-cache.service';

@Injectable()
export class MenuAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
    private readonly validator: MenuHierarchyValidator,
    private readonly cacheService: NavigationCacheService,
    private readonly logger: LoggerService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger.setContext(MenuAdminService.name);
  }

  async getAllMenus(moduleId?: string): Promise<any[]> {
    return this.prisma.menu.findMany({
      where: moduleId ? { moduleId } : {},
      orderBy: { displayOrder: 'asc' },
      include: {
        module: { select: { id: true, code: true, name: true } },
        parent: { select: { id: true, code: true, displayName: true } },
      },
    });
  }

  async getMenuById(id: string): Promise<any> {
    const menu = await this.prisma.menu.findUnique({
      where: { id },
      include: {
        module: true,
        parent: true,
        children: { orderBy: { displayOrder: 'asc' } },
      },
    });

    if (!menu) {
      throw new NotFoundException(`Menu item with ID "${id}" not found`);
    }

    return menu;
  }

  async createMenu(dto: CreateMenuDto): Promise<any> {
    const context = this.requestContext.getContext();
    const performedBy = context?.userId || 'SYSTEM';

    await this.validator.validateCodeUniqueness(dto.code);
    await this.validator.validateRouteUniqueness(dto.route);

    if (dto.parentId) {
      await this.validator.validateMove(dto.code, dto.parentId);
    }

    const createdMenu = await this.prisma.menu.create({
      data: {
        code: dto.code,
        moduleId: dto.moduleId,
        parentId: dto.parentId || null,
        route: dto.route,
        componentIdentifier: dto.componentIdentifier,
        displayName: dto.displayName,
        icon: dto.icon,
        tooltip: dto.tooltip,
        description: dto.description,
        permissions: dto.permissions || [],
        permissionMode: dto.permissionMode || 'ALL',
        displayOrder: dto.displayOrder ?? 0,
        badge: dto.badge,
        searchKeywords: dto.searchKeywords || [],
        status: dto.status || MenuStatus.ACTIVE,
        isSystem: false,
      },
    });

    await this.eventBus.publish(
      new MenuCreatedEvent({
        menuId: createdMenu.id,
        code: createdMenu.code,
        displayName: createdMenu.displayName,
        route: createdMenu.route,
        performedBy,
      }),
    );

    await this.cacheService.invalidateAllNavigation();

    this.logger.log(
      `Navigation menu created: ${createdMenu.displayName} (${createdMenu.code})`,
    );

    return createdMenu;
  }

  async updateMenu(id: string, dto: UpdateMenuDto): Promise<any> {
    const context = this.requestContext.getContext();
    const performedBy = context?.userId || 'SYSTEM';

    const existing = await this.getMenuById(id);

    if (dto.code && dto.code !== existing.code) {
      if (existing.isSystem) {
        throw new BadRequestException('System menu code cannot be changed');
      }
      await this.validator.validateCodeUniqueness(dto.code, id);
    }

    if (dto.route && dto.route !== existing.route) {
      await this.validator.validateRouteUniqueness(dto.route, id);
    }

    const updatedMenu = await this.prisma.menu.update({
      where: { id },
      data: {
        code: dto.code,
        moduleId: dto.moduleId,
        parentId: dto.parentId !== undefined ? dto.parentId : existing.parentId,
        route: dto.route,
        componentIdentifier: dto.componentIdentifier,
        displayName: dto.displayName,
        icon: dto.icon,
        tooltip: dto.tooltip,
        description: dto.description,
        permissions: dto.permissions,
        permissionMode: dto.permissionMode,
        displayOrder: dto.displayOrder,
        badge: dto.badge,
        searchKeywords: dto.searchKeywords,
        status: dto.status,
      },
    });

    await this.eventBus.publish(
      new MenuUpdatedEvent({
        menuId: updatedMenu.id,
        code: updatedMenu.code,
        previousState: {
          code: existing.code,
          displayName: existing.displayName,
          route: existing.route,
        },
        newState: {
          code: updatedMenu.code,
          displayName: updatedMenu.displayName,
          route: updatedMenu.route,
        },
        performedBy,
      }),
    );

    await this.cacheService.invalidateAllNavigation();

    return updatedMenu;
  }

  async moveMenu(id: string, dto: MoveMenuDto): Promise<any> {
    const existing = await this.getMenuById(id);
    const targetParentId =
      dto.targetParentId !== undefined ? dto.targetParentId : existing.parentId;

    await this.validator.validateMove(id, targetParentId);

    const updatedMenu = await this.prisma.menu.update({
      where: { id },
      data: {
        parentId: targetParentId,
        moduleId: dto.targetModuleId || existing.moduleId,
        displayOrder:
          dto.displayOrder !== undefined
            ? dto.displayOrder
            : existing.displayOrder,
      },
    });

    await this.cacheService.invalidateAllNavigation();

    this.logger.log(
      `Menu moved: ${existing.code} -> parentId=${targetParentId}`,
    );

    return updatedMenu;
  }

  async reorderMenus(dto: ReorderMenusDto): Promise<{ success: boolean }> {
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.menu.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        }),
      ),
    );

    await this.cacheService.invalidateAllNavigation();

    this.logger.log(`Reordered ${dto.items.length} menu items`);

    return { success: true };
  }

  async updateMenuStatus(id: string, dto: UpdateMenuStatusDto): Promise<any> {
    const existing = await this.getMenuById(id);

    const updatedMenu = await this.prisma.menu.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.cacheService.invalidateAllNavigation();

    this.logger.log(
      `Menu status updated for ${existing.code}: status=${dto.status}`,
    );

    return updatedMenu;
  }

  async duplicateMenu(id: string): Promise<any> {
    const source = await this.getMenuById(id);
    const copyCode = `${source.code}_COPY_${Date.now().toString().slice(-4)}`;

    const copyMenu = await this.createMenu({
      code: copyCode,
      moduleId: source.moduleId,
      parentId: source.parentId,
      route: `${source.route}-copy`,
      componentIdentifier: source.componentIdentifier,
      displayName: `${source.displayName} (Copy)`,
      icon: source.icon,
      tooltip: source.tooltip,
      description: source.description,
      permissions: source.permissions,
      permissionMode: source.permissionMode,
      displayOrder: source.displayOrder + 1,
      badge: source.badge,
      searchKeywords: source.searchKeywords,
      status: MenuStatus.DISABLED,
    });

    return copyMenu;
  }

  async deleteMenu(id: string): Promise<{ success: boolean }> {
    const context = this.requestContext.getContext();
    const performedBy = context?.userId || 'SYSTEM';

    const existing = await this.getMenuById(id);

    if (existing.isSystem) {
      throw new BadRequestException('System menu items cannot be deleted');
    }

    const childCount = await this.prisma.menu.count({
      where: { parentId: id },
    });

    if (childCount > 0) {
      throw new BadRequestException(
        `Cannot delete menu "${existing.displayName}" because it has ${childCount} child submenus. Delete or move submenus first.`,
      );
    }

    await this.prisma.menu.delete({
      where: { id },
    });

    await this.eventBus.publish(
      new MenuDeletedEvent({
        menuId: id,
        code: existing.code,
        performedBy,
      }),
    );

    await this.cacheService.invalidateAllNavigation();

    this.logger.log(`Menu deleted: ${existing.code}`);

    return { success: true };
  }
}
