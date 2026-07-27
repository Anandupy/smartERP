import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { LoggerService } from '@/common/logger/logger.service';

@Injectable()
export class PermissionCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(PermissionCatalogService.name);
  }

  /**
   * Get all active permission categories sorted by display order
   */
  async getCategories() {
    return this.prisma.permissionCategory.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Get all active permissions with category details
   */
  async getPermissions(categoryId?: string) {
    const where: any = { isActive: true };
    if (categoryId) {
      where.categoryId = categoryId;
    }

    return this.prisma.permission.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: [
        { category: { displayOrder: 'asc' } },
        { displayOrder: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  /**
   * Get a single permission by ID
   */
  async getPermissionById(id: string) {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!permission) {
      throw new NotFoundException(`Permission with ID "${id}" not found`);
    }

    return permission;
  }

  /**
   * Get a single permission by Name
   */
  async getPermissionByName(name: string) {
    const permission = await this.prisma.permission.findUnique({
      where: { name },
      include: { category: true },
    });

    if (!permission) {
      throw new NotFoundException(`Permission with name "${name}" not found`);
    }

    return permission;
  }

  /**
   * Retrieve permission metadata for authorization debugging or documentation
   */
  async getPermissionMetadata(permissionIdOrName: string) {
    const permission = await this.prisma.permission.findFirst({
      where: {
        OR: [{ id: permissionIdOrName }, { name: permissionIdOrName }],
      },
      include: { category: true },
    });

    if (!permission) {
      throw new NotFoundException(
        `Permission "${permissionIdOrName}" not found`,
      );
    }

    return {
      id: permission.id,
      name: permission.name,
      categoryCode: permission.category.code,
      categoryName: permission.category.name,
      description: permission.description,
      isSystem: permission.isSystem,
      isActive: permission.isActive,
      displayOrder: permission.displayOrder,
    };
  }
}
