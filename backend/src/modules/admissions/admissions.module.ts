import { Module } from '@nestjs/common';
import { MastersModule } from './masters/masters.module';
import { NumberingModule } from './numbering/numbering.module';
import { GuardiansModule } from './guardians/guardians.module';
import { ApplicantModule } from './applicant/applicant.module';
import { WorkflowModule } from './workflow/workflow.module';
import { EnrollmentModule } from './enrollment/enrollment.module';

@Module({
  imports: [
    MastersModule,
    NumberingModule,
    GuardiansModule,
    ApplicantModule,
    WorkflowModule,
    EnrollmentModule,
  ],
  exports: [
    MastersModule,
    NumberingModule,
    GuardiansModule,
    ApplicantModule,
    WorkflowModule,
    EnrollmentModule,
  ],
})
export class AdmissionsModule {}
