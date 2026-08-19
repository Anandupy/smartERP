import { Injectable, ConflictException, Inject } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { ResourceScope } from '@/common/scope/resource-scope';
import {
  AdmissionsMasterCreatedEvent,
  AdmissionsMasterUpdatedEvent,
  AdmissionsMasterDeletedEvent,
} from '@/common/events';

/**
 * One relation, declared on a Prisma master model, that references this
 * master and should be checked before a delete is allowed.
 *
 * `filterSoftDeleted` must be `true` only when the *referencing* model has
 * its own `deletedAt` column (`Applicant`, `Admission`, `Student` today) — a
 * soft-deleted row on that side no longer represents an active dependency,
 * so it is excluded from the "in use" check. Relations to a model with no
 * `deletedAt` of its own (`ApplicantGuardianMapping`, `Guardianship`) must
 * leave this `false`: removing the mapping/guardianship row itself is how
 * that reference ends, and passing an unknown `where.deletedAt` to Prisma for
 * those models would fail at runtime, not silently no-op.
 */
export interface MasterReferenceRelation {
  relation: string;
  filterSoftDeleted: boolean;
}

/**
 * Shared CRUD for admissions reference data (Religion, Caste, Category, ...).
 *
 * A row is visible in a scope if it is a system-wide default (`organizationId`
 * and `branchId` both null), an organization-wide default (`organizationId`
 * matches, `branchId` null), or scoped exactly to the caller's branch. Only
 * the API never creates the first two — they exist solely as seed data — so
 * mutation is deliberately narrower than visibility: a branch cannot edit or
 * remove a default it did not create, only rows scoped exactly to it. A miss
 * on either check surfaces as 404, never 403, so a cross-tenant id cannot be
 * used to probe for existence.
 */
@Injectable()
export class BaseMasterService {
  @Inject(EventBus)
  protected readonly eventBus!: EventBus;

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly modelName: string,
    /** Relations that reference this master, each naming whether the far side excludes its own soft-deleted rows. See `MasterReferenceRelation`. */
    protected readonly referenceRelations: MasterReferenceRelation[] = [],
  ) {}

  private visibleWhere(scope: ResourceScope) {
    return {
      OR: [
        { organizationId: null, branchId: null },
        { organizationId: scope.organizationId, branchId: null },
        { organizationId: scope.organizationId, branchId: scope.branchId },
      ],
    };
  }

  async create(dto: any, scope: ResourceScope) {
    const { code, name } = dto;

    const existingCode = await (this.prisma as any)[this.modelName].findFirst({
      where: {
        organizationId: scope.organizationId,
        branchId: scope.branchId,
        code: { equals: code, mode: 'insensitive' },
        deletedAt: null,
      },
    });
    if (existingCode) {
      throw new ConflictException({
        error: 'DUPLICATE_CODE',
        message: `Master with code '${code}' already exists in this scope`,
      });
    }

    const existingName = await (this.prisma as any)[this.modelName].findFirst({
      where: {
        organizationId: scope.organizationId,
        branchId: scope.branchId,
        name: { equals: name, mode: 'insensitive' },
        deletedAt: null,
      },
    });
    if (existingName) {
      throw new ConflictException({
        error: 'DUPLICATE_NAME',
        message: `Master with name '${name}' already exists in this scope`,
      });
    }

    const record = await (this.prisma as any)[this.modelName].create({
      data: {
        ...dto,
        organizationId: scope.organizationId,
        branchId: scope.branchId,
      },
    });

    await this.eventBus.publish(
      new AdmissionsMasterCreatedEvent({
        masterType: this.modelName,
        id: record.id,
        code: record.code,
        name: record.name,
      }),
    );

    return record;
  }

  async findAll(scope: ResourceScope, includeInactive = false) {
    return (this.prisma as any)[this.modelName].findMany({
      where: {
        ...this.visibleWhere(scope),
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async findOne(id: string, scope: ResourceScope) {
    const record = await (this.prisma as any)[this.modelName].findFirst({
      where: { id, ...this.visibleWhere(scope), deletedAt: null },
    });
    if (!record) {
      throw new NotFoundException(`Master record not found`);
    }
    return record;
  }

  /** Existence check confined to rows scoped exactly to the caller's branch. */
  private async findOwned(id: string, scope: ResourceScope) {
    const record = await (this.prisma as any)[this.modelName].findFirst({
      where: {
        id,
        organizationId: scope.organizationId,
        branchId: scope.branchId,
        deletedAt: null,
      },
    });
    if (!record) {
      throw new NotFoundException(`Master record not found`);
    }
    return record;
  }

  async update(id: string, dto: any, scope: ResourceScope) {
    await this.findOwned(id, scope);

    if (dto.code) {
      const existingCode = await (this.prisma as any)[this.modelName].findFirst(
        {
          where: {
            id: { not: id },
            organizationId: scope.organizationId,
            branchId: scope.branchId,
            code: { equals: dto.code, mode: 'insensitive' },
            deletedAt: null,
          },
        },
      );
      if (existingCode) {
        throw new ConflictException({
          error: 'DUPLICATE_CODE',
          message: `Master with code '${dto.code}' already exists in this scope`,
        });
      }
    }

    if (dto.name) {
      const existingName = await (this.prisma as any)[this.modelName].findFirst(
        {
          where: {
            id: { not: id },
            organizationId: scope.organizationId,
            branchId: scope.branchId,
            name: { equals: dto.name, mode: 'insensitive' },
            deletedAt: null,
          },
        },
      );
      if (existingName) {
        throw new ConflictException({
          error: 'DUPLICATE_NAME',
          message: `Master with name '${dto.name}' already exists in this scope`,
        });
      }
    }

    const updated = await (this.prisma as any)[this.modelName].update({
      where: { id },
      data: dto,
    });

    await this.eventBus.publish(
      new AdmissionsMasterUpdatedEvent({
        masterType: this.modelName,
        id: updated.id,
        code: updated.code,
        name: updated.name,
      }),
    );

    return updated;
  }

  async remove(id: string, scope: ResourceScope) {
    await this.findOwned(id, scope);

    if (this.referenceRelations.length > 0) {
      const usage = await (this.prisma as any)[this.modelName].findFirst({
        where: { id },
        select: Object.fromEntries(
          this.referenceRelations.map(({ relation, filterSoftDeleted }) => [
            relation,
            {
              ...(filterSoftDeleted ? { where: { deletedAt: null } } : {}),
              select: { id: true },
              take: 1,
            },
          ]),
        ),
      });
      const inUse = this.referenceRelations.some(
        ({ relation }) => (usage?.[relation]?.length ?? 0) > 0,
      );
      if (inUse) {
        throw new ConflictException({
          error: 'MASTER_IN_USE',
          message:
            'This record is referenced by existing applicant, student or admission records and cannot be deleted. Deactivate it instead.',
        });
      }
    }

    const deleted = await (this.prisma as any)[this.modelName].update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.eventBus.publish(
      new AdmissionsMasterDeletedEvent({
        masterType: this.modelName,
        id: deleted.id,
      }),
    );

    return deleted;
  }
}
