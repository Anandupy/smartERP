import { Module } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
import {
  ApplicantChecklistController,
  WorkflowPolicyController,
} from './workflow-read.controller';
import { OfferExpiryJob } from './offer-expiry.job';
import { AdmissionConfigProvider } from '../admission-config.provider';
import { IdentityModule } from '@/modules/identity/identity.module';
import { AuthorizationModule } from '@/modules/authorization/authorization.module';
import { ConfigurationModule } from '@/modules/configuration/configuration.module';
import { DocumentsModule } from '@/modules/documents/documents.module';

/**
 * The applicant state machine and the sweep that closes lapsed offers.
 *
 * Imports Identity for `PersonService.resolve()` at submission — Admissions
 * does no identity matching of its own — Authorization to check the
 * per-transition permission the table declares, and Documents for
 * `ChecklistService`, which gives the `DOCUMENT_CHECKLIST_SATISFIED` guard
 * its real answer (§11.6). The edge runs one way, `admissions -> documents`;
 * Documents has no import back.
 */
@Module({
  imports: [
    IdentityModule,
    AuthorizationModule,
    DocumentsModule,
    ConfigurationModule,
  ],
  controllers: [
    WorkflowController,
    WorkflowPolicyController,
    ApplicantChecklistController,
  ],
  providers: [WorkflowService, OfferExpiryJob, AdmissionConfigProvider],
  exports: [WorkflowService, OfferExpiryJob, AdmissionConfigProvider],
})
export class WorkflowModule {}
