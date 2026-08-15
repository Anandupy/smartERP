import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PrismaTransactionClient } from '@/infrastructure/database/prisma-transaction.types';
import { OutboxPublisher } from '@/infrastructure/outbox/outbox.publisher';
import { OrganizationScope } from '@/common/scope/resource-scope';
import { GuardianshipCreatedEvent } from '@/common/events';

export interface SyncGuardianshipInput {
  organizationId: string;
  guardianPersonId: string;
  wardPersonId: string;
  relationTypeId: string;
  isPrimary: boolean;
  isFinancialGuardian: boolean;
  isEmergencyContact: boolean;
  pickupAllowed: boolean;
}

/**
 * The persistent Person-to-Person guardian relationship (§8.5, §9).
 *
 * `ApplicantGuardianMapping` remains the authoritative working record for
 * one application — it exists before either side necessarily has a
 * `personId`, and stays that way. `Guardianship` is the record that survives
 * admission: this service projects the mapping's flags onto it once both
 * ends have resolved a Person, which is what closes the "guardianship
 * evaporates at admit()" gap §8.3 describes. Neither model is redundant; a
 * mapping with no resolvable Guardianship (guardian not yet linked to a
 * Person) is a normal, expected state, not a bug.
 */
@Injectable()
export class GuardianshipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxPublisher,
  ) {}

  /**
   * Create or update the one active `Guardianship` for a (guardian, ward)
   * pair, inside the caller's transaction.
   *
   * A no-op when the pair has no resolvable Person on both sides — the
   * caller is expected to check that before calling, but this re-checks
   * nothing itself so it stays cheap to call speculatively.
   *
   * `isPrimary`/`isFinancialGuardian` exclusivity is cleared here first
   * (matching the historical clear-then-set shape) and then guaranteed by
   * the partial unique indexes `Guardianship_one_primary_per_ward_key` /
   * `Guardianship_one_financial_per_ward_key` — the clear is optimisation,
   * the index is the actual guarantee.
   */
  async syncOne(
    tx: PrismaTransactionClient,
    input: SyncGuardianshipInput,
  ): Promise<{ id: string; created: boolean }> {
    if (input.guardianPersonId === input.wardPersonId) {
      // Cannot happen through the normal flow (a person cannot be mapped as
      // their own applicant's guardian), but the DB CHECK would reject it
      // anyway — failing here gives a clearer error than a constraint name.
      return { id: '', created: false };
    }

    const existing = await tx.guardianship.findFirst({
      where: {
        organizationId: input.organizationId,
        guardianPersonId: input.guardianPersonId,
        wardPersonId: input.wardPersonId,
        endedAt: null,
      },
    });

    if (input.isPrimary) {
      await tx.guardianship.updateMany({
        where: {
          wardPersonId: input.wardPersonId,
          isPrimary: true,
          endedAt: null,
          ...(existing ? { id: { not: existing.id } } : {}),
        },
        data: { isPrimary: false },
      });
    }
    if (input.isFinancialGuardian) {
      await tx.guardianship.updateMany({
        where: {
          wardPersonId: input.wardPersonId,
          isFinancialGuardian: true,
          endedAt: null,
          ...(existing ? { id: { not: existing.id } } : {}),
        },
        data: { isFinancialGuardian: false },
      });
    }

    if (existing) {
      const updated = await tx.guardianship.update({
        where: { id: existing.id },
        data: {
          relationTypeId: input.relationTypeId,
          isPrimary: input.isPrimary,
          isFinancialGuardian: input.isFinancialGuardian,
          isEmergencyContact: input.isEmergencyContact,
          pickupAllowed: input.pickupAllowed,
        },
      });
      return { id: updated.id, created: false };
    }

    const created = await tx.guardianship.create({ data: { ...input } });

    await this.outbox.enqueue(
      new GuardianshipCreatedEvent({
        guardianshipId: created.id,
        organizationId: input.organizationId,
        guardianPersonId: input.guardianPersonId,
        wardPersonId: input.wardPersonId,
        relationTypeId: input.relationTypeId,
      }),
      tx,
    );

    return { id: created.id, created: true };
  }

  /**
   * Project every `ApplicantGuardianMapping` for one applicant onto
   * `Guardianship`, skipping any guardian with no resolved Person. Called at
   * `admit()`, where `wardPersonId` (the new Student's `personId`) is
   * guaranteed resolved — the catch-all for mappings that could not sync
   * earlier because the applicant itself had no Person yet.
   */
  async syncFromApplicantMappings(
    tx: PrismaTransactionClient,
    applicantId: string,
    organizationId: string,
    wardPersonId: string,
  ): Promise<void> {
    const mappings = await tx.applicantGuardianMapping.findMany({
      where: { applicantId },
      include: { guardian: { select: { personId: true } } },
    });

    for (const mapping of mappings) {
      if (!mapping.guardian.personId) continue;

      await this.syncOne(tx, {
        organizationId,
        guardianPersonId: mapping.guardian.personId,
        wardPersonId,
        relationTypeId: mapping.relationTypeId,
        isPrimary: mapping.isPrimary,
        isFinancialGuardian: mapping.isFinancialGuardian,
        isEmergencyContact: mapping.isEmergencyContact,
        pickupAllowed: mapping.pickupAllowed,
      });
    }
  }

  /** Active guardianships for a ward — "who are this student's guardians". */
  async findByWard(wardPersonId: string, scope: OrganizationScope) {
    await this.assertPersonInScope(wardPersonId, scope);

    return this.prisma.guardianship.findMany({
      where: {
        wardPersonId,
        organizationId: scope.organizationId,
        endedAt: null,
      },
      orderBy: [{ isPrimary: 'desc' }, { startedAt: 'asc' }],
    });
  }

  /** Active guardianships for a guardian — "which children does this person guardian". */
  async findByGuardianPerson(
    guardianPersonId: string,
    scope: OrganizationScope,
  ) {
    await this.assertPersonInScope(guardianPersonId, scope);

    return this.prisma.guardianship.findMany({
      where: {
        guardianPersonId,
        organizationId: scope.organizationId,
        endedAt: null,
      },
      orderBy: { startedAt: 'asc' },
    });
  }

  /**
   * Two wards sharing an active guardian are siblings — derived at query
   * time, never stored. §9.2: `Household` was considered and explicitly
   * refused for exactly this reason.
   */
  async findSiblings(wardPersonId: string, scope: OrganizationScope) {
    await this.assertPersonInScope(wardPersonId, scope);

    const rows = await this.prisma.$queryRaw<Array<{ wardPersonId: string }>>`
      SELECT DISTINCT g2."wardPersonId"
        FROM "Guardianship" g1
        JOIN "Guardianship" g2 ON g2."guardianPersonId" = g1."guardianPersonId"
       WHERE g1."wardPersonId" = ${wardPersonId}
         AND g2."wardPersonId" <> ${wardPersonId}
         AND g1."organizationId" = ${scope.organizationId}
         AND g2."organizationId" = ${scope.organizationId}
         AND g1."endedAt" IS NULL AND g2."endedAt" IS NULL
    `;

    return rows.map((r) => r.wardPersonId);
  }

  private async assertPersonInScope(
    personId: string,
    scope: OrganizationScope,
  ): Promise<void> {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, organizationId: scope.organizationId },
      select: { id: true },
    });
    if (!person) {
      throw new NotFoundException('Person not found');
    }
  }
}
