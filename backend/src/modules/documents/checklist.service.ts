import { Injectable } from '@nestjs/common';
import {
  AdmissionApplicationStatus,
  DocumentOwnerType,
  DocumentStatus,
  DocumentVerificationStatus,
} from '@/generated/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PrismaTransactionClient } from '@/infrastructure/database/prisma-transaction.types';

export interface ChecklistApplicantContext {
  applicantId: string;
  personId: string | null;
  programId: string | null;
  quotaId: string | null;
  categoryId: string | null;
}

export interface MissingRequirement {
  documentTypeId: string;
  code: string;
  name: string;
}

/**
 * Gives `DOCUMENT_CHECKLIST_SATISFIED` a real answer (§11.6). Until this
 * service existed the guard `WorkflowService` declared on `documentsReceived`
 * and `approve` returned unconditionally — a fabricated control that passed
 * every time while looking like one.
 *
 * "Which stage" a requirement is in force for is resolved by the caller
 * (`WorkflowService`) supplying the exact set of `AdmissionApplicationStatus`
 * values relevant to the transition being guarded — normally the applicant's
 * current status and the transition's target. This service does not
 * reconstruct the workflow's own state-graph ordering; that knowledge stays
 * in `workflow.transitions.ts`, which is the one-way dependency direction
 * (`admissions -> documents`, never the reverse).
 *
 * A requirement is satisfied by a `VERIFIED` current version on either an
 * `APPLICANT`-owned or (once resolved) `PERSON`-owned document of the
 * matching type — matching §11.3's ownership table, since a birth
 * certificate required "for this applicant" is legitimately a `PERSON`-owned
 * document. Expiry never blocks satisfaction (§11.5: "Expiry does not
 * invalidate an admission").
 */
@Injectable()
export class ChecklistService {
  constructor(private readonly prisma: PrismaService) {}

  async isSatisfied(
    applicant: ChecklistApplicantContext,
    stages: AdmissionApplicationStatus[],
    organizationId: string,
    tx?: PrismaTransactionClient,
  ): Promise<{ satisfied: boolean; missing: MissingRequirement[] }> {
    if (stages.length === 0) return { satisfied: true, missing: [] };

    const client = tx ?? this.prisma;

    const candidates = await client.documentRequirement.findMany({
      where: {
        organizationId,
        isMandatory: true,
        isActive: true,
        deletedAt: null,
        requiredByStage: { in: stages },
      },
      include: {
        documentType: { select: { id: true, code: true, name: true } },
      },
    });

    const applicable = candidates.filter(
      (requirement) =>
        (requirement.appliesToProgramId === null ||
          requirement.appliesToProgramId === applicant.programId) &&
        (requirement.appliesToQuotaId === null ||
          requirement.appliesToQuotaId === applicant.quotaId) &&
        (requirement.appliesToCategoryId === null ||
          requirement.appliesToCategoryId === applicant.categoryId),
    );

    if (applicable.length === 0) return { satisfied: true, missing: [] };

    const ownerFilters: Array<{
      ownerType: DocumentOwnerType;
      ownerId: string;
    }> = [
      {
        ownerType: DocumentOwnerType.APPLICANT,
        ownerId: applicant.applicantId,
      },
      ...(applicant.personId
        ? [{ ownerType: DocumentOwnerType.PERSON, ownerId: applicant.personId }]
        : []),
    ];

    const missing: MissingRequirement[] = [];
    for (const requirement of applicable) {
      const satisfying = await client.document.findFirst({
        where: {
          organizationId,
          documentTypeId: requirement.documentTypeId,
          status: DocumentStatus.ACTIVE,
          OR: ownerFilters,
          currentVersion: {
            verificationStatus: DocumentVerificationStatus.VERIFIED,
          },
        },
        select: { id: true },
      });

      if (!satisfying) {
        missing.push({
          documentTypeId: requirement.documentTypeId,
          code: requirement.documentType.code,
          name: requirement.documentType.name,
        });
      }
    }

    return { satisfied: missing.length === 0, missing };
  }
}
