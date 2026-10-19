import { Module } from '@nestjs/common';
import { GuardiansService } from './guardians.service';
import { GuardiansController } from './guardians.controller';
import { GuardianshipService } from './guardianship.service';
import { GuardianshipController } from './guardianship.controller';
import { IdentityModule } from '@/modules/identity/identity.module';
import { AuthorizationModule } from '@/modules/authorization/authorization.module';

/**
 * Imports Identity for `PersonService` — Guardian resolves against the
 * Person index the same way Applicant and admission conversion do. The edge
 * runs in the allowed direction (`admissions -> identity`); Identity gains
 * no edge back. Authorization decides whether an edit may record a first
 * Aadhaar on a linked identity (`person.attach_government_id`).
 */
@Module({
  imports: [IdentityModule, AuthorizationModule],
  controllers: [GuardiansController, GuardianshipController],
  providers: [GuardiansService, GuardianshipService],
  exports: [GuardiansService, GuardianshipService],
})
export class GuardiansModule {}
