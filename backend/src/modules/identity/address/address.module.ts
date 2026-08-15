import { Module } from '@nestjs/common';
import { AddressService } from './address.service';
import { AddressController } from './address.controller';

/**
 * S2 — Address / PersonAddress, resolved through Person.
 *
 * Depends on Prisma and the outbox and nothing else — the same rule as
 * PersonModule: this must never import Applicant, Student, Admission or
 * Enrollment.
 */
@Module({
  controllers: [AddressController],
  providers: [AddressService],
  exports: [AddressService],
})
export class AddressModule {}
