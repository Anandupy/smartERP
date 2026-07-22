import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { SystemSettingsUpdatedEvent } from '@/common/events';
import { CreateSystemDto } from './dto/create-system.dto';
import { UpdateSystemDto } from './dto/update-system.dto';

@Injectable()
export class SystemSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async initSystem(dto: CreateSystemDto, userId?: string) {
    const existingSystem = await this.prisma.systemSetting.findFirst();

    if (existingSystem) {
      throw new BadRequestException('System already initialized');
    }

    const system = await this.prisma.systemSetting.create({
      data: {
        ...dto,
        createdBy: userId,
      },
    });

    await this.eventBus.publish(
      new SystemSettingsUpdatedEvent({
        systemId: system.id,
        productName: system.productName,
        environment: system.environment,
      }),
    );

    return system;
  }

  async getSystem() {
    const system = await this.prisma.systemSetting.findFirst();
    if (!system) {
      throw new NotFoundException(
        'System settings not found. Please initialize the system.',
      );
    }
    return system;
  }

  async updateSystem(dto: UpdateSystemDto, userId?: string) {
    const existingSystem = await this.prisma.systemSetting.findFirst();

    if (!existingSystem) {
      throw new NotFoundException('System settings not found');
    }

    const updated = await this.prisma.systemSetting.update({
      where: { id: existingSystem.id },
      data: {
        ...dto,
        updatedBy: userId,
      },
    });

    await this.eventBus.publish(
      new SystemSettingsUpdatedEvent({
        systemId: updated.id,
        productName: updated.productName,
        environment: updated.environment,
      }),
    );

    return updated;
  }
}
