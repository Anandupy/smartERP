import { Module } from '@nestjs/common';
import { MastersModule } from './masters/masters.module';
import { GuardiansModule } from './guardians/guardians.module';
import { ApplicantModule } from './applicant/applicant.module';
import { WorkflowModule } from './workflow/workflow.module';
import { EnrollmentModule } from './enrollment/enrollment.module';
import { AdmissionModule } from './admission/admission.module';

@Module({
  imports: [
    MastersModule,
    GuardiansModule,
    ApplicantModule,
    WorkflowModule,
    EnrollmentModule,
    AdmissionModule,
  ],
  exports: [
    MastersModule,
    GuardiansModule,
    ApplicantModule,
    WorkflowModule,
    EnrollmentModule,
    AdmissionModule,
  ],
})
export class AdmissionsModule {}
