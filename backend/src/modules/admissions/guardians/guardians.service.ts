import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import {
  GuardianCreatedEvent,
  GuardianUpdatedEvent,
  GuardianMappedEvent,
  GuardianUnmappedEvent,
} from '@/common/events';
import {
  CreateGuardianDto,
  UpdateGuardianDto,
  MapGuardianDto,
} from './dto/guardian.dto';

@Injectable()
export class GuardiansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async create(dto: CreateGuardianDto, orgId: string, branchId: string) {
    const guardian = await this.prisma.guardian.create({
      data: {
        ...dto,
        organizationId: orgId,
        branchId,
      },
    });

    await this.eventBus.publish(
      new GuardianCreatedEvent({
        guardianId: guardian.id,
        firstName: guardian.firstName,
        lastName: guardian.lastName,
        mobilePrimary: guardian.mobilePrimary,
      }),
    );

    return guardian;
  }

  async findOne(id: string) {
    const guardian = await this.prisma.guardian.findFirst({
      where: { id, deletedAt: null },
    });
    if (!guardian) {
      throw new NotFoundException('Guardian not found');
    }
    return guardian;
  }

  async update(id: string, dto: UpdateGuardianDto) {
    await this.findOne(id);
    const updated = await this.prisma.guardian.update({
      where: { id },
      data: dto,
    });

    await this.eventBus.publish(
      new GuardianUpdatedEvent({
        guardianId: updated.id,
      }),
    );

    return updated;
  }

  async search(searchTerm: string, branchId: string) {
    if (!searchTerm) {
      return [];
    }

    return this.prisma.guardian.findMany({
      where: {
        branchId,
        deletedAt: null,
        OR: [
          { mobilePrimary: { contains: searchTerm } },
          { aadhaarNo: { contains: searchTerm } },
          { firstName: { contains: searchTerm, mode: 'insensitive' } },
          { lastName: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      take: 10,
    });
  }

  async mapGuardianToApplicant(applicantId: string, dto: MapGuardianDto) {
    // 1. Verify applicant exists
    const applicant = await this.prisma.applicant.findFirst({
      where: { id: applicantId, deletedAt: null },
    });
    if (!applicant) {
      throw new NotFoundException('Applicant not found');
    }

    // 2. Verify guardian exists
    await this.findOne(dto.guardianId);

    // 3. Verify relationType exists
    const relType = await this.prisma.relationType.findFirst({
      where: { id: dto.relationTypeId, deletedAt: null },
    });
    if (!relType) {
      throw new NotFoundException('Relation Type not found');
    }

    // 4. Handle primary guardian rule: only one guardian can be primary per applicant
    if (dto.isPrimary) {
      await this.prisma.applicantGuardianMapping.updateMany({
        where: { applicantId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    // 5. Create or update mapping
    const mapping = await this.prisma.applicantGuardianMapping.upsert({
      where: {
        applicantId_guardianId: {
          applicantId,
          guardianId: dto.guardianId,
        },
      },
      create: {
        applicantId,
        guardianId: dto.guardianId,
        relationTypeId: dto.relationTypeId,
        isPrimary: dto.isPrimary || false,
        isEmergencyContact: dto.isEmergencyContact || false,
        isFinancialGuardian: dto.isFinancialGuardian || false,
        pickupAllowed: dto.pickupAllowed !== false,
        priority: dto.priority || 1,
      },
      update: {
        relationTypeId: dto.relationTypeId,
        isPrimary: dto.isPrimary || false,
        isEmergencyContact: dto.isEmergencyContact || false,
        isFinancialGuardian: dto.isFinancialGuardian || false,
        pickupAllowed: dto.pickupAllowed !== false,
        priority: dto.priority || 1,
      },
    });

    await this.eventBus.publish(
      new GuardianMappedEvent({
        applicantId: mapping.applicantId,
        guardianId: mapping.guardianId,
        relationTypeId: mapping.relationTypeId,
        isPrimary: mapping.isPrimary,
      }),
    );

    return mapping;
  }

  async getMappedGuardians(applicantId: string) {
    return this.prisma.applicantGuardianMapping.findMany({
      where: { applicantId },
      include: {
        guardian: true,
        relationType: true,
      },
      orderBy: { priority: 'asc' },
    });
  }

  async removeMapping(applicantId: string, guardianId: string) {
    const mapping = await this.prisma.applicantGuardianMapping.findUnique({
      where: {
        applicantId_guardianId: { applicantId, guardianId },
      },
    });

    if (!mapping) {
      throw new NotFoundException('Guardian mapping not found');
    }

    const deletedMapping = await this.prisma.applicantGuardianMapping.delete({
      where: {
        applicantId_guardianId: { applicantId, guardianId },
      },
    });

    await this.eventBus.publish(
      new GuardianUnmappedEvent({
        applicantId: deletedMapping.applicantId,
        guardianId: deletedMapping.guardianId,
      }),
    );

    return deletedMapping;
  }
}
