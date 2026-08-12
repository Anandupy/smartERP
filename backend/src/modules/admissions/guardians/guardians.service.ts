import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import {
  GuardianCreatedEvent,
  GuardianUpdatedEvent,
  GuardianMappedEvent,
  GuardianUnmappedEvent,
} from '@/common/events';
import { ResourceScope, scopedWhere } from '@/common/scope/resource-scope';
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

  async create(dto: CreateGuardianDto, scope: ResourceScope) {
    const guardian = await this.prisma.guardian.create({
      data: {
        ...dto,
        organizationId: scope.organizationId,
        branchId: scope.branchId,
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

  /**
   * Read one guardian **within the caller's scope**.
   *
   * A row belonging to another organization or branch is simply not found —
   * the caller cannot distinguish that from an id that does not exist.
   */
  async findOne(id: string, scope: ResourceScope) {
    const guardian = await this.prisma.guardian.findFirst({
      where: { id, ...scopedWhere(scope), deletedAt: null },
    });
    if (!guardian) {
      throw new NotFoundException('Guardian not found');
    }
    return guardian;
  }

  /**
   * The write re-asserts scope in its own `WHERE` rather than trusting the
   * preceding read, so a read-then-write-by-id can never drift into a
   * cross-tenant write.
   */
  async update(id: string, dto: UpdateGuardianDto, scope: ResourceScope) {
    await this.findOne(id, scope);

    const result = await this.prisma.guardian.updateMany({
      where: { id, ...scopedWhere(scope), deletedAt: null },
      data: dto,
    });

    if (result.count !== 1) {
      throw new NotFoundException('Guardian not found');
    }

    const updated = await this.prisma.guardian.findFirstOrThrow({
      where: { id },
    });

    await this.eventBus.publish(
      new GuardianUpdatedEvent({
        guardianId: updated.id,
      }),
    );

    return updated;
  }

  async search(searchTerm: string, scope: ResourceScope) {
    if (!searchTerm) {
      return [];
    }

    return this.prisma.guardian.findMany({
      where: {
        ...scopedWhere(scope),
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

  private async findApplicantInScope(
    applicantId: string,
    scope: ResourceScope,
  ) {
    const applicant = await this.prisma.applicant.findFirst({
      where: { id: applicantId, ...scopedWhere(scope), deletedAt: null },
    });
    if (!applicant) {
      throw new NotFoundException('Applicant not found');
    }
    return applicant;
  }

  async mapGuardianToApplicant(
    applicantId: string,
    dto: MapGuardianDto,
    scope: ResourceScope,
  ) {
    // 1. Verify applicant exists in scope
    await this.findApplicantInScope(applicantId, scope);

    // 2. Verify guardian exists in scope
    await this.findOne(dto.guardianId, scope);

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

  async getMappedGuardians(applicantId: string, scope: ResourceScope) {
    await this.findApplicantInScope(applicantId, scope);

    return this.prisma.applicantGuardianMapping.findMany({
      where: { applicantId },
      include: {
        guardian: true,
        relationType: true,
      },
      orderBy: { priority: 'asc' },
    });
  }

  async removeMapping(
    applicantId: string,
    guardianId: string,
    scope: ResourceScope,
  ) {
    await this.findApplicantInScope(applicantId, scope);
    await this.findOne(guardianId, scope);

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
