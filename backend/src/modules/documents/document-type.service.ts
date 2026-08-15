import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { ResourceScope } from '@/common/scope/resource-scope';
import {
  AdmissionsMasterCreatedEvent,
  AdmissionsMasterUpdatedEvent,
  AdmissionsMasterDeletedEvent,
} from '@/common/events';
import {
  CreateDocumentTypeDto,
  UpdateDocumentTypeDto,
} from './dto/document-type.dto';

/**
 * DocumentType — the same visibility/scoping shape as the Admissions
 * masters (`BaseMasterService`), written directly rather than through that
 * generic base: DocumentType carries fields (`hasExpiry`,
 * `allowedMimeTypes`, ...) the base's `any`-typed CRUD has no way to
 * validate, and forcing it through would trade type safety for a few lines
 * of reuse.
 *
 * Reuses `AdmissionsMasterCreatedEvent` et al. rather than inventing a
 * parallel set — a DocumentType *is* reference data of the same shape the
 * admissions masters already are, just owned by a different module.
 */
@Injectable()
export class DocumentTypeService {
  @Inject(EventBus)
  private readonly eventBus!: EventBus;

  constructor(private readonly prisma: PrismaService) {}

  private visibleWhere(scope: ResourceScope) {
    return {
      OR: [
        { organizationId: null, branchId: null },
        { organizationId: scope.organizationId, branchId: null },
        { organizationId: scope.organizationId, branchId: scope.branchId },
      ],
    };
  }

  async create(dto: CreateDocumentTypeDto, scope: ResourceScope) {
    const duplicate = await this.prisma.documentType.findFirst({
      where: {
        organizationId: scope.organizationId,
        branchId: scope.branchId,
        deletedAt: null,
        OR: [
          { code: { equals: dto.code, mode: 'insensitive' } },
          { name: { equals: dto.name, mode: 'insensitive' } },
        ],
      },
    });
    if (duplicate) {
      throw new ConflictException({
        error: 'DUPLICATE_DOCUMENT_TYPE',
        message: `A document type with this code or name already exists in this scope`,
      });
    }

    const record = await this.prisma.documentType.create({
      data: {
        organizationId: scope.organizationId,
        branchId: scope.branchId,
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        isSensitive: dto.isSensitive ?? false,
        hasExpiry: dto.hasExpiry ?? false,
        defaultValidityMonths: dto.defaultValidityMonths ?? null,
        retentionYears: dto.retentionYears ?? null,
        allowedMimeTypes: dto.allowedMimeTypes,
        maxSizeBytes: dto.maxSizeBytes ?? 10_485_760,
        displayOrder: dto.displayOrder ?? 0,
      },
    });

    await this.eventBus.publish(
      new AdmissionsMasterCreatedEvent({
        masterType: 'DocumentType',
        id: record.id,
        code: record.code,
        name: record.name,
      }),
    );

    return record;
  }

  async findAll(scope: ResourceScope, includeInactive = false) {
    return this.prisma.documentType.findMany({
      where: {
        ...this.visibleWhere(scope),
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async findOne(id: string, scope: ResourceScope) {
    const record = await this.prisma.documentType.findFirst({
      where: { id, ...this.visibleWhere(scope), deletedAt: null },
    });
    if (!record) throw new NotFoundException('Document type not found');
    return record;
  }

  private async findOwned(id: string, scope: ResourceScope) {
    const record = await this.prisma.documentType.findFirst({
      where: {
        id,
        organizationId: scope.organizationId,
        branchId: scope.branchId,
        deletedAt: null,
      },
    });
    if (!record) throw new NotFoundException('Document type not found');
    return record;
  }

  async update(id: string, dto: UpdateDocumentTypeDto, scope: ResourceScope) {
    await this.findOwned(id, scope);

    if (dto.code || dto.name) {
      const duplicate = await this.prisma.documentType.findFirst({
        where: {
          id: { not: id },
          organizationId: scope.organizationId,
          branchId: scope.branchId,
          deletedAt: null,
          OR: [
            ...(dto.code
              ? [{ code: { equals: dto.code, mode: 'insensitive' as const } }]
              : []),
            ...(dto.name
              ? [{ name: { equals: dto.name, mode: 'insensitive' as const } }]
              : []),
          ],
        },
      });
      if (duplicate) {
        throw new ConflictException({
          error: 'DUPLICATE_DOCUMENT_TYPE',
          message: `A document type with this code or name already exists in this scope`,
        });
      }
    }

    const updated = await this.prisma.documentType.update({
      where: { id },
      data: dto,
    });

    await this.eventBus.publish(
      new AdmissionsMasterUpdatedEvent({
        masterType: 'DocumentType',
        id: updated.id,
        code: updated.code,
        name: updated.name,
      }),
    );

    return updated;
  }

  async remove(id: string, scope: ResourceScope) {
    await this.findOwned(id, scope);

    const [requirementUsage, documentUsage] = await Promise.all([
      this.prisma.documentRequirement.findFirst({
        where: { documentTypeId: id, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.document.findFirst({
        where: { documentTypeId: id },
        select: { id: true },
      }),
    ]);

    if (requirementUsage || documentUsage) {
      throw new ConflictException({
        error: 'DOCUMENT_TYPE_IN_USE',
        message:
          'This document type is referenced by an existing requirement or document and cannot be deleted. Deactivate it instead.',
      });
    }

    const deleted = await this.prisma.documentType.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.eventBus.publish(
      new AdmissionsMasterDeletedEvent({
        masterType: 'DocumentType',
        id: deleted.id,
      }),
    );

    return deleted;
  }
}
