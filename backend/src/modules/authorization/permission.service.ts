import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { LoggerService } from '@/common/logger/logger.service';

@Injectable()
export class PermissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(PermissionService.name);
  }

  /**
   * Get all permission categories sorted by display order
   */
  async getCategories() {
    return this.prisma.permissionCategory.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Get all permissions with category details
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
   * Get a single permission by ID or Name
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
}
