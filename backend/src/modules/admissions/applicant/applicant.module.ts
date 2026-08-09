import { Module } from '@nestjs/common';
import { ApplicantService } from './applicant.service';
import { ApplicantPreferenceService } from './applicant-preference.service';
import { ApplicantController } from './applicant.controller';

@Module({
  controllers: [ApplicantController],
  providers: [ApplicantService, ApplicantPreferenceService],
  exports: [ApplicantService, ApplicantPreferenceService],
})
export class ApplicantModule {}
