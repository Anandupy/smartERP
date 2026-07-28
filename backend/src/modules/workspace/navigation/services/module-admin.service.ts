import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { LoggerService } from '@/common/logger/logger.service';
import { RequestContextService } from '@/common/logger/request-context.service';
import {
  ModuleCreatedEvent,
  ModuleUpdatedEvent,
} from '@/common/events/workspace.events';
import { CreateModuleDto } from '../dto/module/create-module.dto';
import { UpdateModuleDto } from '../dto/module/update-module.dto';
import { UpdateModuleStatusDto } from '../dto/module/module-status.dto';
import { NavigationCacheService } from './navigation-cache.service';

@Injectable()
export class ModuleAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
    private readonly cacheService: NavigationCacheService,
    private readonly logger: LoggerService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger.setContext(ModuleAdminService.name);
  }

  async getAllModules(): Promise<any[]> {
    return this.prisma.module.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: {
          select: { menus: true },
        },
      },
    });
  }

  async getModuleById(id: string): Promise<any> {
    const mod = await this.prisma.module.findUnique({
      where: { id },
      include: {
        menus: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!mod) {
      throw new NotFoundException(`Module with ID "${id}" not found`);
    }

    return mod;
  }

  async createModule(dto: CreateModuleDto): Promise<any> {
    const context = this.requestContext.getContext();
    const performedBy = context?.userId || 'SYSTEM';

    const existing = await this.prisma.module.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException(
        `Module with code "${dto.code}" already exists`,
      );
    }

    const createdModule = await this.prisma.module.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        icon: dto.icon,
        displayOrder: dto.displayOrder ?? 0,
        isSystem: false,
        isActive: true,
      },
    });

    await this.eventBus.publish(
      new ModuleCreatedEvent({
        moduleId: createdModule.id,
        code: createdModule.code,
        name: createdModule.name,
        performedBy,
      }),
    );

    await this.cacheService.invalidateAllNavigation();

    this.logger.log(
      `Navigation module created: ${createdModule.name} (${createdModule.code})`,
    );

    return createdModule;
  }

  async updateModule(id: string, dto: UpdateModuleDto): Promise<any> {
    const context = this.requestContext.getContext();
    const performedBy = context?.userId || 'SYSTEM';

    const existing = await this.getModuleById(id);

    if (dto.code && dto.code !== existing.code) {
      if (existing.isSystem) {
        throw new BadRequestException('System module code cannot be changed');
      }
      const codeExists = await this.prisma.module.findUnique({
        where: { code: dto.code },
      });
      if (codeExists) {
        throw new ConflictException(
          `Module with code "${dto.code}" already exists`,
        );
      }
    }

    const updatedModule = await this.prisma.module.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        icon: dto.icon,
        displayOrder: dto.displayOrder,
      },
    });

    await this.eventBus.publish(
      new ModuleUpdatedEvent({
        moduleId: updatedModule.id,
        code: updatedModule.code,
        previousState: {
          code: existing.code,
          name: existing.name,
          displayOrder: existing.displayOrder,
        },
        newState: {
          code: updatedModule.code,
          name: updatedModule.name,
          displayOrder: updatedModule.displayOrder,
        },
        performedBy,
      }),
    );

    await this.cacheService.invalidateAllNavigation();

    return updatedModule;
  }

  async updateModuleStatus(
    id: string,
    dto: UpdateModuleStatusDto,
  ): Promise<any> {
    const existing = await this.getModuleById(id);

    const updatedModule = await this.prisma.module.update({
      where: { id },
      data: { isActive: dto.isActive },
    });

    await this.cacheService.invalidateAllNavigation();

    this.logger.log(
      `Module status updated for ${existing.code}: isActive=${dto.isActive}`,
    );

    return updatedModule;
  }

  async deleteModule(id: string): Promise<{ success: boolean }> {
    const existing = await this.getModuleById(id);

    if (existing.isSystem) {
      throw new BadRequestException('System modules cannot be deleted');
    }

    const menuCount = await this.prisma.menu.count({
      where: { moduleId: id },
    });

    if (menuCount > 0) {
      throw new BadRequestException(
        `Cannot delete module "${existing.name}" because it contains ${menuCount} menu items. Delete or reassign menus first.`,
      );
    }

    await this.prisma.module.delete({
      where: { id },
    });

    await this.cacheService.invalidateAllNavigation();

    this.logger.log(`Module deleted: ${existing.code}`);

    return { success: true };
  }
}
