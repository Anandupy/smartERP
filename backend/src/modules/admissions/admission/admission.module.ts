import { Module } from '@nestjs/common';
import { AdmissionService } from './admission.service';
import { AdmissionConversionService } from './admission-conversion.service';
import { AdmissionConversionController } from './admission-conversion.controller';
import { WorkflowModule } from '../workflow/workflow.module';
import { GuardiansModule } from '../guardians/guardians.module';
import { IdentityModule } from '@/modules/identity/identity.module';
import { EnrollmentModule } from '@/modules/enrollment/enrollment.module';
import { AuthorizationModule } from '@/modules/authorization/authorization.module';

/**
 * The spell-of-study domain, and the conversion that opens one.
 *
 * `AdmissionService` has no controller — nothing creates, updates or lists
 * admissions over HTTP, because the fields that matter are immutable once
 * written and creation belongs to an operation that knows *why*.
 *
 * `AdmissionConversionService` is that operation. It imports identity,
 * enrollment, workflow and guardians because it composes all of them inside
 * one transaction — including projecting `ApplicantGuardianMapping` onto the
 * persistent `Guardianship` once the new Student's `personId` exists, which
 * is what stops a guardian relationship evaporating at admission (§8.3). The
 * edges it adds all run in the allowed direction — `admissions → identity`
 * and `admissions → enrollment` — and none of those modules gains an edge back.
 */
@Module({
  imports: [
    WorkflowModule,
    IdentityModule,
    EnrollmentModule,
    AuthorizationModule,
    GuardiansModule,
  ],
  controllers: [AdmissionConversionController],
  providers: [AdmissionService, AdmissionConversionService],
  exports: [AdmissionService, AdmissionConversionService],
})
export class AdmissionModule {}
