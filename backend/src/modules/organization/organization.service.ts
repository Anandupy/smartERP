import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import {
  OrganizationCreatedEvent,
  OrganizationUpdatedEvent,
  OrganizationDeletedEvent,
} from '@/common/events';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationStatus } from '@/generated/client';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async createOrganization(dto: CreateOrganizationDto, userId?: string) {
    const code = dto.code.trim().toLowerCase();

    const existing = await this.prisma.organization.findUnique({
      where: { code },
    });

    if (existing) {
      throw new ConflictException('Organization with this code already exists');
    }

    const org = await this.prisma.organization.create({
      data: {
        ...dto,
        code,
        status: OrganizationStatus.ACTIVE,
        createdBy: userId,
      },
    });

    await this.eventBus.publish(
      new OrganizationCreatedEvent({
        organizationId: org.id,
        name: org.name,
        code: org.code,
      }),
    );

    return org;
  }

  async getAllOrganizations() {
    return this.prisma.organization.findMany({
      where: { status: { not: OrganizationStatus.INACTIVE } },
    });
  }

  async getOrganizationById(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async updateOrganization(
    id: string,
    dto: UpdateOrganizationDto,
    userId?: string,
  ) {
    const organization = await this.getOrganizationById(id);

    if (dto.code) {
      const code = dto.code.trim().toLowerCase();
      if (code !== organization.code) {
        const existing = await this.prisma.organization.findUnique({
          where: { code },
        });
        if (existing) {
          throw new ConflictException(
            'Organization with this code already exists',
          );
        }
      }
    }

    const updated = await this.prisma.organization.update({
      where: { id },
      data: {
        ...dto,
        updatedBy: userId,
      },
    });

    await this.eventBus.publish(
      new OrganizationUpdatedEvent({
        organizationId: updated.id,
        name: updated.name,
        code: updated.code,
      }),
    );

    return updated;
  }

  async softDeleteOrganization(id: string, userId?: string) {
    await this.getOrganizationById(id);

    const deleted = await this.prisma.organization.update({
      where: { id },
      data: {
        status: OrganizationStatus.INACTIVE,
        updatedBy: userId,
      },
    });

    await this.eventBus.publish(
      new OrganizationDeletedEvent({
        organizationId: deleted.id,
      }),
    );

    return deleted;
  }
}
