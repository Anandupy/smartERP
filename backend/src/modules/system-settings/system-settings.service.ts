import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { CreateSystemDto } from './dto/create-system.dto';
import { UpdateSystemDto } from './dto/update-system.dto';

@Injectable()
export class SystemSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async initSystem(dto: CreateSystemDto, userId?: string) {
    const existingSystem = await this.prisma.systemSetting.findFirst();
    
    if (existingSystem) {
      throw new BadRequestException('System already initialized');
    }

    return this.prisma.systemSetting.create({
      data: {
        ...dto,
        createdBy: userId,
      },
    });
  }

  async getSystem() {
    const system = await this.prisma.systemSetting.findFirst();
    if (!system) {
      throw new NotFoundException('System settings not found. Please initialize the system.');
    }
    return system;
  }

  async updateSystem(dto: UpdateSystemDto, userId?: string) {
    const existingSystem = await this.prisma.systemSetting.findFirst();

    if (!existingSystem) {
      throw new NotFoundException('System settings not found');
    }

    return this.prisma.systemSetting.update({
      where: { id: existingSystem.id },
      data: {
        ...dto,
        updatedBy: userId,
      },
    });
  }
}
