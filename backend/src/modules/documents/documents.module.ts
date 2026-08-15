import { Module } from '@nestjs/common';
import { DocumentTypeService } from './document-type.service';
import { DocumentTypeController } from './document-type.controller';
import { DocumentRequirementService } from './document-requirement.service';
import { DocumentRequirementController } from './document-requirement.controller';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { OwnerResolverService } from './owner-resolver.service';
import { ChecklistService } from './checklist.service';

/**
 * S3 — Document Management foundation.
 *
 * Depends on nothing from `admissions` or `identity` as a module edge —
 * owner scope validation (`OwnerResolverService`) reads Person, Applicant,
 * Admission, Enrollment, Student, Organization and Branch directly through
 * the shared `PrismaService`, the same way `GuardianshipService` reads
 * `Person` without importing `IdentityModule`. That keeps the dependency
 * edge one-way: `admissions -> documents` (via `WorkflowModule`, for the
 * checklist guard), never the reverse.
 *
 * `StorageModule`, `ScanModule` and `CryptoModule` are `@Global()` and need
 * no explicit import here.
 */
@Module({
  controllers: [
    DocumentTypeController,
    DocumentRequirementController,
    DocumentController,
  ],
  providers: [
    DocumentTypeService,
    DocumentRequirementService,
    OwnerResolverService,
    ChecklistService,
    DocumentService,
  ],
  exports: [
    DocumentService,
    ChecklistService,
    DocumentTypeService,
    DocumentRequirementService,
  ],
})
export class DocumentsModule {}
