import { Module } from '@nestjs/common';
import { ApplicantService } from './applicant.service';
import { ApplicantPreferenceService } from './applicant-preference.service';
import { ApplicantController } from './applicant.controller';
import { IdentityModule } from '@/modules/identity/identity.module';
import { AuthorizationModule } from '@/modules/authorization/authorization.module';

/**
 * Imports Identity for `PersonService`, so an edit to a submitted
 * application's Aadhaar is checked against the identity it was resolved to.
 * Same allowed direction as Guardians (`admissions -> identity`).
 * Authorization decides whether that edit may also record a first Aadhaar on
 * the identity (`person.attach_government_id`).
 */
@Module({
  imports: [IdentityModule, AuthorizationModule],
  controllers: [ApplicantController],
  providers: [ApplicantService, ApplicantPreferenceService],
  exports: [ApplicantService, ApplicantPreferenceService],
})
export class ApplicantModule {}
