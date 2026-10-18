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
  /**
   * The applicant's own branch. A requirement with a `branchId` binds only
   * that branch; one without binds every branch of the organization.
   */
  branchId: string;
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
 * The workflow stages at which a requirement can actually be enforced.
 *
 * A requirement is evaluated when a guarded transition leaves or enters its
 * stage (`WorkflowService` supplies `[current, target]`). This is the union of
 * those stages over every rule carrying `DOCUMENT_CHECKLIST_SATISFIED` in
 * `workflow.transitions.ts` — kept here as data, rather than imported, so the
 * dependency still runs `admissions -> documents` only. A unit test in the
 * admissions suite asserts the two never drift.
 *
 * `DEFERRED`, `REJECTED`, `WITHDRAWN` and `CANCELLED` are absent because no
 * guarded transition touches them: a requirement at one of those stages would
 * be accepted and never checked, so `DocumentRequirementService` refuses it.
 */
export const ENFORCEABLE_REQUIREMENT_STAGES: readonly AdmissionApplicationStatus[] =
  [
    AdmissionApplicationStatus.DRAFT,
    AdmissionApplicationStatus.SUBMITTED,
    AdmissionApplicationStatus.UNDER_REVIEW,
    AdmissionApplicationStatus.DOCUMENT_PENDING,
    AdmissionApplicationStatus.FEE_PENDING,
    AdmissionApplicationStatus.WAITLISTED,
    AdmissionApplicationStatus.APPROVED,
    AdmissionApplicationStatus.SEAT_CONFIRMED,
    AdmissionApplicationStatus.ADMITTED,
  ];

/** Where one requirement stands for one applicant. */
export type ChecklistItemStatus =
  | 'VERIFIED'
  | 'PENDING_VERIFICATION'
  | 'REJECTED'
  | 'MISSING';

export interface ChecklistItem {
  requirementId: string;
  documentTypeId: string;
  code: string;
  name: string;
  requiredByStage: AdmissionApplicationStatus;
  isMandatory: boolean;
  /** Null when the requirement applies to every branch. */
  branchId: string | null;
  status: ChecklistItemStatus;
  /** The document whose current version decided `status`, if any. */
  documentId: string | null;
  satisfied: boolean;
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
 * A requirement binds an applicant when it is in the applicant's organization
 * **and** either organization-wide (`branchId` null) or written for the
 * applicant's own branch. Until 2026-10-17 the branch was ignored, so a
 * requirement written for one branch blocked every branch of the organization.
 *
 * A requirement is satisfied by a `VERIFIED` current version on either an
 * `APPLICANT`-owned or (once resolved) `PERSON`-owned document of the
 * matching type — matching §11.3's ownership table, since a birth
 * certificate required "for this applicant" is legitimately a `PERSON`-owned
 * document. An uploaded but unverified version never satisfies one. Expiry
 * never blocks satisfaction (§11.5: "Expiry does not invalidate an admission").
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

    const applicable = await this.applicableRequirements(
      client,
      applicant,
      organizationId,
      { isMandatory: true, requiredByStage: { in: stages } },
    );

    if (applicable.length === 0) return { satisfied: true, missing: [] };

    const missing: MissingRequirement[] = [];
    for (const requirement of applicable) {
      const satisfying = await client.document.findFirst({
        where: {
          organizationId,
          documentTypeId: requirement.documentTypeId,
          status: DocumentStatus.ACTIVE,
          OR: this.ownerFilters(applicant),
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

  /**
   * Every requirement that binds this applicant, mandatory or not, with where
   * the applicant stands on each — the read model behind
   * `GET /admissions/applicants/:id/checklist`.
   *
   * Uses exactly the matching rules `isSatisfied` enforces, so the screen and
   * the guard cannot disagree about which documents are owed.
   */
  async describe(
    applicant: ChecklistApplicantContext,
    organizationId: string,
  ): Promise<ChecklistItem[]> {
    const requirements = await this.applicableRequirements(
      this.prisma,
      applicant,
      organizationId,
      {},
    );
    if (requirements.length === 0) return [];

    const documents = await this.prisma.document.findMany({
      where: {
        organizationId,
        status: DocumentStatus.ACTIVE,
        documentTypeId: {
          in: [...new Set(requirements.map((r) => r.documentTypeId))],
        },
        OR: this.ownerFilters(applicant),
      },
      select: {
        id: true,
        documentTypeId: true,
        currentVersion: { select: { verificationStatus: true } },
      },
    });

    const rank: Record<ChecklistItemStatus, number> = {
      VERIFIED: 3,
      PENDING_VERIFICATION: 2,
      REJECTED: 1,
      MISSING: 0,
    };

    return requirements
      .map((requirement) => {
        let best: { status: ChecklistItemStatus; documentId: string | null } = {
          status: 'MISSING',
          documentId: null,
        };

        for (const document of documents) {
          if (document.documentTypeId !== requirement.documentTypeId) continue;
          const verification = document.currentVersion?.verificationStatus;
          const status: ChecklistItemStatus =
            verification === DocumentVerificationStatus.VERIFIED
              ? 'VERIFIED'
              : verification === DocumentVerificationStatus.REJECTED
                ? 'REJECTED'
                : 'PENDING_VERIFICATION';
          if (rank[status] > rank[best.status]) {
            best = { status, documentId: document.id };
          }
        }

        return {
          requirementId: requirement.id,
          documentTypeId: requirement.documentTypeId,
          code: requirement.documentType.code,
          name: requirement.documentType.name,
          requiredByStage: requirement.requiredByStage,
          isMandatory: requirement.isMandatory,
          branchId: requirement.branchId,
          status: best.status,
          documentId: best.documentId,
          satisfied: best.status === 'VERIFIED',
        };
      })
      .sort(
        (a, b) =>
          ENFORCEABLE_REQUIREMENT_STAGES.indexOf(a.requiredByStage) -
            ENFORCEABLE_REQUIREMENT_STAGES.indexOf(b.requiredByStage) ||
          a.name.localeCompare(b.name),
      );
  }

  // ---------------------------------------------------------------------------

  private async applicableRequirements(
    client: PrismaTransactionClient | PrismaService,
    applicant: ChecklistApplicantContext,
    organizationId: string,
    extra: {
      isMandatory?: boolean;
      requiredByStage?: { in: AdmissionApplicationStatus[] };
    },
  ) {
    const candidates = await client.documentRequirement.findMany({
      where: {
        organizationId,
        // Organization-wide, or written for this applicant's branch — never
        // another branch's.
        OR: [{ branchId: null }, { branchId: applicant.branchId }],
        isActive: true,
        deletedAt: null,
        ...extra,
      },
      include: {
        documentType: { select: { id: true, code: true, name: true } },
      },
    });

    return candidates.filter(
      (requirement) =>
        (requirement.appliesToProgramId === null ||
          requirement.appliesToProgramId === applicant.programId) &&
        (requirement.appliesToQuotaId === null ||
          requirement.appliesToQuotaId === applicant.quotaId) &&
        (requirement.appliesToCategoryId === null ||
          requirement.appliesToCategoryId === applicant.categoryId),
    );
  }

  private ownerFilters(applicant: ChecklistApplicantContext) {
    return [
      {
        ownerType: DocumentOwnerType.APPLICANT,
        ownerId: applicant.applicantId,
      },
      ...(applicant.personId
        ? [{ ownerType: DocumentOwnerType.PERSON, ownerId: applicant.personId }]
        : []),
    ];
  }
}
