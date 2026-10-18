import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { OrganizationScope } from '@/common/scope/resource-scope';
import { AdmissionApplicationStatus } from '@/generated/client';
import {
  CreateDocumentRequirementDto,
  UpdateDocumentRequirementDto,
} from './dto/document-requirement.dto';
import { ENFORCEABLE_REQUIREMENT_STAGES } from './checklist.service';

/**
 * The rule that a file must exist (§11.2). Deliberately thin: variance is
 * `programId x quotaId x categoryId`, each nullable meaning "applies to
 * all" — no admission-type axis (Applicant has no such column, §11.2 note
 * in `document.prisma`), and no full rules engine. Institution policy is
 * expressed as a set of these rows, not as code.
 */
@Injectable()
export class DocumentRequirementService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDocumentRequirementDto, scope: OrganizationScope) {
    this.assertEnforceableStage(dto.requiredByStage);

    if (dto.branchId) {
      await this.assertBranchInScope(dto.branchId, scope);
    }

    await this.assertNoDuplicate(scope, {
      branchId: dto.branchId ?? null,
      documentTypeId: dto.documentTypeId,
      appliesToProgramId: dto.appliesToProgramId ?? null,
      appliesToQuotaId: dto.appliesToQuotaId ?? null,
      appliesToCategoryId: dto.appliesToCategoryId ?? null,
      requiredByStage: dto.requiredByStage,
    });

    return this.prisma.documentRequirement.create({
      data: {
        organizationId: scope.organizationId,
        branchId: dto.branchId ?? null,
        documentTypeId: dto.documentTypeId,
        appliesToProgramId: dto.appliesToProgramId ?? null,
        appliesToQuotaId: dto.appliesToQuotaId ?? null,
        appliesToCategoryId: dto.appliesToCategoryId ?? null,
        requiredByStage: dto.requiredByStage,
        isMandatory: dto.isMandatory ?? true,
      },
    });
  }

  /**
   * Refuse a stage no workflow transition checks.
   *
   * A requirement at `DEFERRED`, `REJECTED`, `WITHDRAWN` or `CANCELLED` would
   * be stored, listed and shown as policy while never blocking anything —
   * the look of a control without the control. See
   * `ENFORCEABLE_REQUIREMENT_STAGES`.
   */
  private assertEnforceableStage(stage: AdmissionApplicationStatus): void {
    if (!ENFORCEABLE_REQUIREMENT_STAGES.includes(stage)) {
      throw new BadRequestException({
        error: 'UNSUPPORTED_REQUIREMENT_STAGE',
        message: `No workflow step checks documents at ${stage}, so a requirement there would never be enforced.`,
        requiredByStage: stage,
        supportedStages: ENFORCEABLE_REQUIREMENT_STAGES,
      });
    }
  }

  async findAll(scope: OrganizationScope, branchId?: string) {
    return this.prisma.documentRequirement.findMany({
      where: {
        organizationId: scope.organizationId,
        deletedAt: null,
        ...(branchId ? { OR: [{ branchId: null }, { branchId }] } : {}),
      },
      include: { documentType: true },
    });
  }

  async findOne(id: string, scope: OrganizationScope) {
    const record = await this.prisma.documentRequirement.findFirst({
      where: { id, organizationId: scope.organizationId, deletedAt: null },
      include: { documentType: true },
    });
    if (!record) throw new NotFoundException('Document requirement not found');
    return record;
  }

  async update(
    id: string,
    dto: UpdateDocumentRequirementDto,
    scope: OrganizationScope,
  ) {
    const existing = await this.findOne(id, scope);

    if (dto.requiredByStage !== undefined) {
      this.assertEnforceableStage(dto.requiredByStage);
    }

    if (dto.branchId) {
      await this.assertBranchInScope(dto.branchId, scope);
    }

    const touchesIdentity =
      dto.branchId !== undefined ||
      dto.documentTypeId !== undefined ||
      dto.appliesToProgramId !== undefined ||
      dto.appliesToQuotaId !== undefined ||
      dto.appliesToCategoryId !== undefined ||
      dto.requiredByStage !== undefined;

    if (touchesIdentity) {
      await this.assertNoDuplicate(
        scope,
        {
          branchId:
            dto.branchId !== undefined
              ? (dto.branchId ?? null)
              : existing.branchId,
          documentTypeId: dto.documentTypeId ?? existing.documentTypeId,
          appliesToProgramId:
            dto.appliesToProgramId !== undefined
              ? (dto.appliesToProgramId ?? null)
              : existing.appliesToProgramId,
          appliesToQuotaId:
            dto.appliesToQuotaId !== undefined
              ? (dto.appliesToQuotaId ?? null)
              : existing.appliesToQuotaId,
          appliesToCategoryId:
            dto.appliesToCategoryId !== undefined
              ? (dto.appliesToCategoryId ?? null)
              : existing.appliesToCategoryId,
          requiredByStage: dto.requiredByStage ?? existing.requiredByStage,
        },
        id,
      );
    }

    return this.prisma.documentRequirement.update({ where: { id }, data: dto });
  }

  async remove(id: string, scope: OrganizationScope) {
    await this.findOne(id, scope);
    return this.prisma.documentRequirement.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * `branchId` arrives from the request body, not the caller's resolved
   * scope (a requirement may deliberately name a branch other than the
   * caller's own, e.g. an org admin scoping a rule to one branch). Unlike
   * `documentTypeId`/`appliesToProgramId`/`appliesToQuotaId`/
   * `appliesToCategoryId`, the column carries no foreign key — `document.prisma`
   * — so nothing before this stopped a caller writing a branch id that does
   * not exist, or exists under a different organization, producing a rule no
   * applicant in this org could ever match.
   */
  private async assertBranchInScope(
    branchId: string,
    scope: OrganizationScope,
  ): Promise<void> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId: scope.organizationId },
      select: { id: true },
    });

    if (!branch) {
      throw new BadRequestException({
        error: 'BRANCH_NOT_IN_ORGANIZATION',
        message: 'branchId must name a branch belonging to this organization.',
      });
    }
  }

  /**
   * Two rows naming the same document type for the same branch, program,
   * quota, category and stage are not a second policy — they are the same
   * rule entered twice. `ChecklistService` would evaluate both independently
   * and report the same missing document twice, which is confusing rather
   * than additive. Mirrors `DocumentTypeService`'s duplicate check (same
   * module, same convention) rather than inventing a new one.
   */
  private async assertNoDuplicate(
    scope: OrganizationScope,
    identity: {
      branchId: string | null;
      documentTypeId: string;
      appliesToProgramId: string | null;
      appliesToQuotaId: string | null;
      appliesToCategoryId: string | null;
      requiredByStage: AdmissionApplicationStatus;
    },
    excludeId?: string,
  ): Promise<void> {
    const duplicate = await this.prisma.documentRequirement.findFirst({
      where: {
        id: excludeId ? { not: excludeId } : undefined,
        organizationId: scope.organizationId,
        deletedAt: null,
        branchId: identity.branchId,
        documentTypeId: identity.documentTypeId,
        appliesToProgramId: identity.appliesToProgramId,
        appliesToQuotaId: identity.appliesToQuotaId,
        appliesToCategoryId: identity.appliesToCategoryId,
        requiredByStage: identity.requiredByStage,
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException({
        error: 'DUPLICATE_DOCUMENT_REQUIREMENT',
        message:
          'A document requirement with this document type, scope and stage already exists.',
        requirementId: duplicate.id,
      });
    }
  }
}
