import { Module } from '@nestjs/common';
import { ApplicantService } from './applicant.service';
import { ApplicantController } from './applicant.controller';
import { NumberingModule } from '../numbering/numbering.module';

@Module({
  imports: [NumberingModule],
  controllers: [ApplicantController],
  providers: [ApplicantService],
  exports: [ApplicantService],
})
export class ApplicantModule {}
