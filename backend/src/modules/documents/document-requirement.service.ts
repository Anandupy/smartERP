import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { OrganizationScope } from '@/common/scope/resource-scope';
import {
  CreateDocumentRequirementDto,
  UpdateDocumentRequirementDto,
} from './dto/document-requirement.dto';

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
    await this.findOne(id, scope);
    return this.prisma.documentRequirement.update({ where: { id }, data: dto });
  }

  async remove(id: string, scope: OrganizationScope) {
    await this.findOne(id, scope);
    return this.prisma.documentRequirement.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
