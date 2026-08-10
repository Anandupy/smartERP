import { Module } from '@nestjs/common';
import { MastersModule } from './masters/masters.module';
import { GuardiansModule } from './guardians/guardians.module';
import { ApplicantModule } from './applicant/applicant.module';
import { WorkflowModule } from './workflow/workflow.module';
import { AdmissionModule } from './admission/admission.module';

/**
 * The intake funnel.
 *
 * Enrollment used to live here and no longer does. Placement continues for
 * twelve years after the three-month admission process has finished, and
 * promotion, examination and corrections all write enrolments without being
 * admissions — bolting a twelve-year concern onto a three-month one is the
 * accidental coupling §18.1 exists to prevent. See `src/modules/enrollment/`.
 */
@Module({
  imports: [
    MastersModule,
    GuardiansModule,
    ApplicantModule,
    WorkflowModule,
    AdmissionModule,
  ],
  exports: [
    MastersModule,
    GuardiansModule,
    ApplicantModule,
    WorkflowModule,
    AdmissionModule,
  ],
})
export class AdmissionsModule {}
