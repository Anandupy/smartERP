import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { RowLockService } from '@/infrastructure/database/row-lock.service';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import { AuthorizationService } from '@/modules/authorization/authorization.service';
import { RoleType } from '@/generated/client';
import { OutboxPublisher } from '@/infrastructure/outbox/outbox.publisher';
import { PersonService } from '@/modules/identity/person/person.service';
import { GuardianshipService } from './guardianship.service';
import {
  GuardianCreatedEvent,
  GuardianPersonLinkedEvent,
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
    private readonly outbox: OutboxPublisher,
    private readonly persons: PersonService,
    private readonly guardianships: GuardianshipService,
    private readonly rowLock: RowLockService,
    private readonly authorization: AuthorizationService,
  ) {}

  /**
   * Create a guardian profile, optionally resolving it against the Person
   * identity index.
   *
   * `dob` is transient: it exists only to call `PersonService.resolve()` and
   * is never stored on Guardian. Person owns date of birth as a matching
   * fact; a copy here would be a second source of truth for something
   * Guardian does not otherwise need. Omitting `dob` (every guardian created
   * before this field existed did) leaves `personId` null — a normal,
   * expected state, not a degraded one.
   */
  async create(dto: CreateGuardianDto, scope: ResourceScope) {
    return this.prisma.$transaction(async (tx) => {
      const { dob, ...guardianFields } = dto;
      const personId = dob
        ? (
            await this.persons.resolve(
              scope.organizationId,
              {
                firstName: dto.firstName,
                middleName: dto.middleName,
                lastName: dto.lastName,
                dob: new Date(dob),
                phone: dto.mobilePrimary,
                governmentId: dto.aadhaarNo,
              },
              tx,
            )
          ).personId
        : null;

      const guardian = await tx.guardian.create({
        data: {
          ...guardianFields,
          personId,
          organizationId: scope.organizationId,
          branchId: scope.branchId,
        },
      });

      await this.outbox.enqueue(
        new GuardianCreatedEvent({
          guardianId: guardian.id,
          organizationId: scope.organizationId,
          hasPersonLink: personId !== null,
        }),
        tx,
      );

      return guardian;
    });
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
   *
   * `dob` links a Person retroactively when the guardian has none yet — the
   * path the one pre-existing, unlinkable Guardian row (and any other
   * created without `dob`) uses to gain a `personId` later. It is ignored,
   * not an error, when the guardian is already linked: re-supplying a DOB on
   * an already-resolved guardian is not this endpoint's job.
   */
  async update(
    id: string,
    dto: UpdateGuardianDto,
    scope: ResourceScope,
    actor: { userId?: string | null; role?: string | null } = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      // An Aadhaar edit and a retroactive link both depend on whether the
      // guardian already has a Person. Serialising them on the row means the
      // read below is the state the write lands on, so two concurrent edits
      // cannot leave the guardian's Aadhaar disagreeing with its identity.
      if (dto.aadhaarNo || dto.dob) {
        await this.rowLock.lockRow(tx, {
          table: 'Guardian',
          id,
          scope: {
            organizationId: scope.organizationId,
            branchId: scope.branchId,
          },
          columns: ['personId'],
        });
      }

      const current = await tx.guardian.findFirst({
        where: { id, ...scopedWhere(scope), deletedAt: null },
      });
      if (!current) {
        throw new NotFoundException('Guardian not found');
      }

      const { dob, ...fields } = dto;
      let personId = current.personId;
      let linkedNow = false;

      if (fields.aadhaarNo && current.personId) {
        await this.persons.reconcileGovernmentId(
          scope.organizationId,
          current.personId,
          fields.aadhaarNo,
          {
            field: 'aadhaarNo',
            mayAttach: () =>
              actor.userId && actor.role
                ? this.authorization.hasPermission(
                    actor.userId,
                    actor.role as RoleType,
                    PERMISSIONS.Person.AttachGovernmentId,
                  )
                : Promise.resolve(false),
          },
          tx,
        );
      }

      if (dob && !current.personId) {
        const resolved = await this.persons.resolve(
          scope.organizationId,
          {
            firstName: fields.firstName ?? current.firstName,
            middleName: fields.middleName ?? current.middleName,
            lastName: fields.lastName ?? current.lastName,
            dob: new Date(dob),
            phone: fields.mobilePrimary ?? current.mobilePrimary,
            governmentId: fields.aadhaarNo ?? current.aadhaarNo,
          },
          tx,
        );
        personId = resolved.personId;
        linkedNow = true;
      }

      const writeData = { ...fields, ...(linkedNow ? { personId } : {}) };

      // `dob` on an already-linked guardian, with nothing else in the
      // request, leaves nothing to write — Prisma rejects an empty `data`.
      // Returning the row unchanged is correct: there was nothing to do.
      if (Object.keys(writeData).length === 0) {
        return current;
      }

      const result = await tx.guardian.updateMany({
        where: { id, ...scopedWhere(scope), deletedAt: null },
        data: writeData,
      });

      if (result.count !== 1) {
        throw new NotFoundException('Guardian not found');
      }

      const updated = await tx.guardian.findFirstOrThrow({ where: { id } });

      await this.outbox.enqueue(
        new GuardianUpdatedEvent({ guardianId: updated.id }),
        tx,
      );

      if (linkedNow && personId) {
        await this.outbox.enqueue(
          new GuardianPersonLinkedEvent({
            guardianId: updated.id,
            organizationId: scope.organizationId,
            personId,
          }),
          tx,
        );
      }

      return updated;
    });
  }

  /**
   * Search guardians for sibling reuse.
   *
   * Mobile and name only — never Aadhaar. A `contains` match on a plaintext
   * government identifier is a substring oracle: any STAFF caller could
   * probe digits they were never shown one character at a time (§8.4 Defect
   * 4). `Person.findCandidates` already refuses to accept a government
   * identifier as a search term for the same reason; this brings Guardian in
   * line rather than inventing a different rule.
   */
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

  /**
   * Map a guardian to an applicant, idempotently.
   *
   * Runs inside one transaction (§8.4 Defect 1: the previous clear-then-set
   * was two unrelated statements, so a failing upsert could leave a ward with
   * no primary guardian, committed). Unset flags are preserved from the
   * existing mapping rather than reset to `false` (§8.4 Defect 5: re-mapping
   * to change only `relationTypeId` used to silently demote the primary
   * guardian).
   *
   * When both the applicant and the guardian have a resolved `personId`,
   * also syncs the persistent `Guardianship` row — the applicant will not
   * always have one yet (personId is set at `submit()`, which may not have
   * happened), in which case `admit()` catches it later.
   */
  async mapGuardianToApplicant(
    applicantId: string,
    dto: MapGuardianDto,
    scope: ResourceScope,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const applicant = await tx.applicant.findFirst({
        where: { id: applicantId, ...scopedWhere(scope), deletedAt: null },
      });
      if (!applicant) {
        throw new NotFoundException('Applicant not found');
      }

      const guardian = await tx.guardian.findFirst({
        where: { id: dto.guardianId, ...scopedWhere(scope), deletedAt: null },
      });
      if (!guardian) {
        throw new NotFoundException('Guardian not found');
      }

      const relType = await tx.relationType.findFirst({
        where: { id: dto.relationTypeId, deletedAt: null },
      });
      if (!relType) {
        throw new NotFoundException('Relation Type not found');
      }

      const existingMapping = await tx.applicantGuardianMapping.findUnique({
        where: {
          applicantId_guardianId: { applicantId, guardianId: dto.guardianId },
        },
      });

      const isPrimary = dto.isPrimary ?? existingMapping?.isPrimary ?? false;
      const isEmergencyContact =
        dto.isEmergencyContact ?? existingMapping?.isEmergencyContact ?? false;
      const isFinancialGuardian =
        dto.isFinancialGuardian ??
        existingMapping?.isFinancialGuardian ??
        false;
      const pickupAllowed =
        dto.pickupAllowed ?? existingMapping?.pickupAllowed ?? true;
      const priority = dto.priority ?? existingMapping?.priority ?? 1;

      if (isPrimary) {
        await tx.applicantGuardianMapping.updateMany({
          where: { applicantId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const mapping = await tx.applicantGuardianMapping.upsert({
        where: {
          applicantId_guardianId: { applicantId, guardianId: dto.guardianId },
        },
        create: {
          applicantId,
          guardianId: dto.guardianId,
          relationTypeId: dto.relationTypeId,
          isPrimary,
          isEmergencyContact,
          isFinancialGuardian,
          pickupAllowed,
          priority,
        },
        update: {
          relationTypeId: dto.relationTypeId,
          isPrimary,
          isEmergencyContact,
          isFinancialGuardian,
          pickupAllowed,
          priority,
        },
      });

      await this.outbox.enqueue(
        new GuardianMappedEvent({
          applicantId: mapping.applicantId,
          guardianId: mapping.guardianId,
          relationTypeId: mapping.relationTypeId,
          isPrimary: mapping.isPrimary,
        }),
        tx,
      );

      if (applicant.personId && guardian.personId) {
        await this.guardianships.syncOne(tx, {
          organizationId: scope.organizationId,
          guardianPersonId: guardian.personId,
          wardPersonId: applicant.personId,
          relationTypeId: dto.relationTypeId,
          isPrimary,
          isFinancialGuardian,
          isEmergencyContact,
          pickupAllowed,
        });
      }

      return mapping;
    });
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

    return this.prisma.$transaction(async (tx) => {
      const mapping = await tx.applicantGuardianMapping.findUnique({
        where: { applicantId_guardianId: { applicantId, guardianId } },
      });

      if (!mapping) {
        throw new NotFoundException('Guardian mapping not found');
      }

      const deletedMapping = await tx.applicantGuardianMapping.delete({
        where: { applicantId_guardianId: { applicantId, guardianId } },
      });

      await this.outbox.enqueue(
        new GuardianUnmappedEvent({
          applicantId: deletedMapping.applicantId,
          guardianId: deletedMapping.guardianId,
        }),
        tx,
      );

      return deletedMapping;
    });
  }
}
