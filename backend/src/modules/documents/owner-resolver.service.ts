import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentOwnerType } from '@/generated/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PrismaTransactionClient } from '@/infrastructure/database/prisma-transaction.types';
import { ResourceScope } from '@/common/scope/resource-scope';

export interface ResolvedOwner {
  organizationId: string;
  /** Null for owners that are organization-scoped for life; see `document.prisma`. */
  branchId: string | null;
}

/**
 * The referential-integrity boundary for `Document.(ownerType, ownerId)`.
 *
 * A normal SQL foreign key cannot point at "whichever table `ownerType`
 * names" — this is that check, done as a SERVICE invariant instead: the
 * owner row is looked up by id **within the caller's own verified scope**,
 * never by trusting a scope the client claims. A cross-tenant `ownerId`
 * therefore 404s here, before any `Document` row is written, the same
 * 404-not-403 rule every other resource lookup in this codebase follows.
 *
 * `Employee` (S4) is not a supported owner type yet — it does not exist.
 * A distinct `GUARDIAN` owner type does not exist either, deliberately:
 * guardian documents are owned by the guardian's own `Person` row (§11.3).
 */
@Injectable()
export class OwnerResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    ownerType: DocumentOwnerType,
    ownerId: string,
    scope: ResourceScope,
    tx?: PrismaTransactionClient,
  ): Promise<ResolvedOwner> {
    const client = tx ?? this.prisma;

    switch (ownerType) {
      case DocumentOwnerType.PERSON: {
        const person = await client.person.findFirst({
          where: { id: ownerId, organizationId: scope.organizationId },
          select: { id: true },
        });
        if (!person) throw new NotFoundException('Owner not found');
        return { organizationId: scope.organizationId, branchId: null };
      }

      case DocumentOwnerType.STUDENT: {
        // Organization-scoped: Student.branchId moves on transfer, so a
        // document tied to the student-as-a-role must not go stale when it
        // does — see `document.prisma`.
        const student = await client.student.findFirst({
          where: {
            id: ownerId,
            organizationId: scope.organizationId,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!student) throw new NotFoundException('Owner not found');
        return { organizationId: scope.organizationId, branchId: null };
      }

      case DocumentOwnerType.APPLICANT: {
        const applicant = await client.applicant.findFirst({
          where: {
            id: ownerId,
            organizationId: scope.organizationId,
            branchId: scope.branchId,
            deletedAt: null,
          },
          select: { id: true, branchId: true },
        });
        if (!applicant) throw new NotFoundException('Owner not found');
        return {
          organizationId: scope.organizationId,
          branchId: applicant.branchId,
        };
      }

      case DocumentOwnerType.ADMISSION: {
        const admission = await client.admission.findFirst({
          where: {
            id: ownerId,
            organizationId: scope.organizationId,
            branchId: scope.branchId,
            deletedAt: null,
          },
          select: { id: true, branchId: true },
        });
        if (!admission) throw new NotFoundException('Owner not found');
        return {
          organizationId: scope.organizationId,
          branchId: admission.branchId,
        };
      }

      case DocumentOwnerType.ENROLLMENT: {
        const enrollment = await client.enrollment.findFirst({
          where: {
            id: ownerId,
            organizationId: scope.organizationId,
            branchId: scope.branchId,
            deletedAt: null,
          },
          select: { id: true, branchId: true },
        });
        if (!enrollment) throw new NotFoundException('Owner not found');
        return {
          organizationId: scope.organizationId,
          branchId: enrollment.branchId,
        };
      }

      case DocumentOwnerType.ORGANIZATION: {
        if (ownerId !== scope.organizationId) {
          throw new NotFoundException('Owner not found');
        }
        return { organizationId: scope.organizationId, branchId: null };
      }

      case DocumentOwnerType.BRANCH: {
        const branch = await client.branch.findFirst({
          where: {
            id: ownerId,
            organizationId: scope.organizationId,
            isDeleted: false,
          },
          select: { id: true },
        });
        if (!branch) throw new NotFoundException('Owner not found');
        return { organizationId: scope.organizationId, branchId: branch.id };
      }

      default: {
        const exhaustive: never = ownerType;
        throw new Error(`Unhandled document owner type: ${String(exhaustive)}`);
      }
    }
  }
}
