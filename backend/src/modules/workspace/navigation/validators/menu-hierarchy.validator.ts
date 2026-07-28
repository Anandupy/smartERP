import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';

export interface HierarchyValidationResult {
  valid: boolean;
  depth: number;
}

@Injectable()
export class MenuHierarchyValidator {
  private static readonly MAX_DEPTH = 3;

  constructor(private readonly prisma: PrismaService) {}

  async validateMove(
    menuId: string,
    targetParentId: string | null,
  ): Promise<HierarchyValidationResult> {
    if (targetParentId === menuId) {
      throw new BadRequestException('A menu item cannot be its own parent');
    }

    if (!targetParentId) {
      return { valid: true, depth: 1 };
    }

    const parent = await this.prisma.menu.findUnique({
      where: { id: targetParentId },
      select: { id: true, parentId: true },
    });

    if (!parent) {
      throw new BadRequestException(
        `Target parent menu with ID "${targetParentId}" does not exist`,
      );
    }

    // 1. Cycle Detection via DFS Ancestor Traversal
    let currId: string | null = parent.id;
    const visited = new Set<string>();

    while (currId) {
      if (currId === menuId) {
        throw new BadRequestException(
          'Circular hierarchy detected: Target parent is a descendant of the menu being moved',
        );
      }
      if (visited.has(currId)) {
        throw new BadRequestException(
          'Database hierarchy cycle detected in ancestor tree',
        );
      }
      visited.add(currId);

      const ancestor: { parentId: string | null } | null =
        await this.prisma.menu.findUnique({
          where: { id: currId },
          select: { parentId: true },
        });
      currId = ancestor?.parentId || null;
    }

    // 2. Depth Limit Calculation
    const parentDepth = visited.size;
    const subtreeDepth = await this.calculateSubtreeDepth(menuId);
    const totalDepth = parentDepth + subtreeDepth;

    if (totalDepth > MenuHierarchyValidator.MAX_DEPTH) {
      throw new BadRequestException(
        `Moving menu would exceed maximum hierarchy depth of ${MenuHierarchyValidator.MAX_DEPTH} levels (calculated depth: ${totalDepth})`,
      );
    }

    return { valid: true, depth: totalDepth };
  }

  private async calculateSubtreeDepth(menuId: string): Promise<number> {
    const children = await this.prisma.menu.findMany({
      where: { parentId: menuId },
      select: { id: true },
    });

    if (children.length === 0) {
      return 1;
    }

    let maxChildDepth = 0;
    for (const child of children) {
      const childDepth = await this.calculateSubtreeDepth(child.id);
      if (childDepth > maxChildDepth) {
        maxChildDepth = childDepth;
      }
    }

    return 1 + maxChildDepth;
  }

  async validateRouteUniqueness(
    route: string,
    excludeMenuId?: string,
  ): Promise<void> {
    if (!route || route.trim() === '') return;

    const existing = await this.prisma.menu.findFirst({
      where: {
        route,
        ...(excludeMenuId ? { NOT: { id: excludeMenuId } } : {}),
      },
    });

    if (existing) {
      throw new ConflictException(
        `Navigation route "${route}" is already assigned to menu "${existing.code}"`,
      );
    }
  }

  async validateCodeUniqueness(
    code: string,
    excludeMenuId?: string,
  ): Promise<void> {
    const existing = await this.prisma.menu.findUnique({
      where: { code },
    });

    if (existing && existing.id !== excludeMenuId) {
      throw new ConflictException(
        `Menu with code "${code}" already exists in the system`,
      );
    }
  }
}
