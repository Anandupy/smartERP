import { Module } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
import { OfferExpiryJob } from './offer-expiry.job';
import { AdmissionConfigProvider } from '../admission-config.provider';
import { IdentityModule } from '@/modules/identity/identity.module';
import { AuthorizationModule } from '@/modules/authorization/authorization.module';

/**
 * The applicant state machine and the sweep that closes lapsed offers.
 *
 * Imports Identity for `PersonService.resolve()` at submission — Admissions
 * does no identity matching of its own — and Authorization to check the
 * per-transition permission the table declares.
 */
@Module({
  imports: [IdentityModule, AuthorizationModule],
  controllers: [WorkflowController],
  providers: [WorkflowService, OfferExpiryJob, AdmissionConfigProvider],
  exports: [WorkflowService, OfferExpiryJob, AdmissionConfigProvider],
})
export class WorkflowModule {}
