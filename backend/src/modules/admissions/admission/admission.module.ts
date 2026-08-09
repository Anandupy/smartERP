import { Module } from '@nestjs/common';
import { AdmissionService } from './admission.service';

/**
 * The spell-of-study domain.
 *
 * No controller: nothing creates, updates or lists admissions over HTTP.
 * Creation belongs to `admit()`, branch transfer, readmission and the migration
 * importer, and the fields that matter are immutable once written.
 */
@Module({
  providers: [AdmissionService],
  exports: [AdmissionService],
})
export class AdmissionModule {}
